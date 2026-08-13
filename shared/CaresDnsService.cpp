#include "DnsService.h"

#include <cares/ares.h>
#include <arpa/inet.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <memory>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <thread>
#include <unordered_map>
#include <utility>

namespace digger::dns {
namespace {

using Clock = std::chrono::steady_clock;

std::string statusMessage(int status) {
  switch (status) {
    case ARES_ETIMEOUT:
      return "The DNS Query timed out.";
    case ARES_ECANCELLED:
      return "The DNS Query was cancelled.";
    case ARES_ECONNREFUSED:
      return "The resolver refused the connection.";
    case ARES_ENOSERVER:
      return "No DNS resolver is available.";
    case ARES_EBADRESP:
    case ARES_EBADQUERY:
      return "The resolver returned an invalid DNS response.";
    default:
      return std::string("The DNS Query failed: ") + ares_strerror(status);
  }
}

std::string canonicalName(const char* value) {
  std::string name = value == nullptr ? "" : value;
  if (!name.empty() && name.back() != '.') {
    name.push_back('.');
  }
  return name;
}

std::string typeName(ares_dns_rec_type_t type) {
  const char* name = ares_dns_rec_type_tostr(type);
  return name == nullptr ? std::to_string(static_cast<int>(type)) : name;
}

std::string className(ares_dns_class_t recordClass) {
  const char* name = ares_dns_class_tostr(recordClass);
  return name == nullptr ? std::to_string(static_cast<int>(recordClass)) : name;
}

std::string recordData(const ares_dns_rr_t* record) {
  char buffer[INET6_ADDRSTRLEN] = {};
  switch (ares_dns_rr_get_type(record)) {
    case ARES_REC_TYPE_A: {
      const auto* address = ares_dns_rr_get_addr(record, ARES_RR_A_ADDR);
      return address != nullptr &&
              inet_ntop(AF_INET, address, buffer, sizeof(buffer)) != nullptr
          ? buffer
          : "";
    }
    case ARES_REC_TYPE_AAAA: {
      const auto* address = ares_dns_rr_get_addr6(record, ARES_RR_AAAA_ADDR);
      return address != nullptr &&
              inet_ntop(AF_INET6, address, buffer, sizeof(buffer)) != nullptr
          ? buffer
          : "";
    }
    default:
      return "";
  }
}

std::vector<Record> records(const ares_dns_record_t* response,
                            ares_dns_section_t section) {
  std::vector<Record> result;
  const auto count = ares_dns_record_rr_cnt(response, section);
  result.reserve(count);
  for (size_t index = 0; index < count; ++index) {
    const auto* record =
        ares_dns_record_rr_get_const(response, section, index);
    if (record == nullptr) {
      continue;
    }
    result.push_back({canonicalName(ares_dns_rr_get_name(record)),
                      typeName(ares_dns_rr_get_type(record)),
                      static_cast<double>(ares_dns_rr_get_ttl(record)),
                      recordData(record)});
  }
  return result;
}

std::vector<std::string> responseFlags(const ares_dns_record_t* response) {
  const auto value = ares_dns_record_get_flags(response);
  std::vector<std::string> result;
  for (const auto& flag : std::vector<std::pair<unsigned short, const char*>>{
           {ARES_FLAG_QR, "qr"}, {ARES_FLAG_AA, "aa"},
           {ARES_FLAG_TC, "tc"}, {ARES_FLAG_RD, "rd"},
           {ARES_FLAG_RA, "ra"}, {ARES_FLAG_AD, "ad"},
           {ARES_FLAG_CD, "cd"}}) {
    if ((value & flag.first) != 0) {
      result.emplace_back(flag.second);
    }
  }
  return result;
}

std::string normalizeCustomServer(const std::string& address,
                                  unsigned short port) {
  in_addr ipv4{};
  in6_addr ipv6{};
  if (inet_pton(AF_INET, address.c_str(), &ipv4) == 1) {
    return address + ":" + std::to_string(port);
  }
  if (inet_pton(AF_INET6, address.c_str(), &ipv6) == 1) {
    return "[" + address + "]:" + std::to_string(port);
  }
  throw std::invalid_argument(
      "Custom resolver address must be a valid IPv4 or IPv6 address.");
}

class CaresDnsService final : public DnsService,
                              public std::enable_shared_from_this<CaresDnsService> {
 public:
  CaresDnsService() {
    const auto status = ares_library_init(ARES_LIB_INIT_ALL);
    if (status != ARES_SUCCESS) {
      throw std::runtime_error(statusMessage(status));
    }
  }

  ~CaresDnsService() override { ares_library_cleanup(); }

  void query(std::string queryId, Query query, Success success,
             Failure failure) override {
    auto operation = std::make_shared<Operation>();
    operation->owner = shared_from_this();
    operation->queryId = std::move(queryId);
    operation->query = std::move(query);
    operation->success = std::move(success);
    operation->failure = std::move(failure);
    operation->started = Clock::now();

    try {
      initialize(*operation);
    } catch (const std::exception& error) {
      operation->failure(error.what());
      return;
    }

    {
      std::lock_guard lock(mutex_);
      if (operations_.contains(operation->queryId)) {
        ares_destroy(operation->channel);
        operation->failure("A DNS Query with this identifier is already active.");
        return;
      }
      operations_[operation->queryId] = operation;
    }

    std::thread([operation] { operation->run(); }).detach();
  }

  void cancel(const std::string& queryId) override {
    std::shared_ptr<Operation> operation;
    {
      std::lock_guard lock(mutex_);
      const auto found = operations_.find(queryId);
      if (found == operations_.end()) {
        return;
      }
      operation = found->second;
    }
    ares_cancel(operation->channel);
  }

 private:
  struct Operation {
    std::shared_ptr<CaresDnsService> owner;
    std::string queryId;
    Query query;
    Success success;
    Failure failure;
    ares_channel_t* channel{};
    Clock::time_point started;
    std::mutex stateMutex;
    bool finished{false};
    std::string actualTransport{"udp"};

    static void serverState(const char*, ares_bool_t, int transport,
                            void* data) {
      auto* operation = static_cast<Operation*>(data);
      std::lock_guard lock(operation->stateMutex);
      if ((transport & ARES_SERV_STATE_TCP) != 0) {
        operation->actualTransport = "tcp";
      }
    }

    static void response(void* data, ares_status_t status, size_t,
                         const ares_dns_record_t* dnsResponse) {
      auto* operation = static_cast<Operation*>(data);
      if (status != ARES_SUCCESS || dnsResponse == nullptr) {
        operation->completeFailure(statusMessage(status));
        return;
      }

      Result result;
      const auto* rcode =
          ares_dns_rcode_tostr(ares_dns_record_get_rcode(dnsResponse));
      result.rcode = rcode == nullptr ? "UNKNOWN" : rcode;
      result.flags = responseFlags(dnsResponse);
      const auto questionCount = ares_dns_record_query_cnt(dnsResponse);
      result.question.reserve(questionCount);
      for (size_t index = 0; index < questionCount; ++index) {
        const char* name = nullptr;
        ares_dns_rec_type_t type{};
        ares_dns_class_t recordClass{};
        if (ares_dns_record_query_get(dnsResponse, index, &name, &type,
                                      &recordClass) == ARES_SUCCESS) {
          result.question.push_back(
              {canonicalName(name), typeName(type), className(recordClass)});
        }
      }
      result.answer = records(dnsResponse, ARES_SECTION_ANSWER);
      result.authority = records(dnsResponse, ARES_SECTION_AUTHORITY);
      result.additional = records(dnsResponse, ARES_SECTION_ADDITIONAL);
      if (operation->query.resolver.mode == Resolver::Mode::Custom) {
        result.server = Endpoint{*operation->query.resolver.address,
                                 static_cast<double>(
                                     *operation->query.resolver.port)};
      }
      {
        std::lock_guard lock(operation->stateMutex);
        result.transport = operation->actualTransport;
      }
      result.elapsedMs = std::chrono::duration<double, std::milli>(
                             Clock::now() - operation->started)
                             .count();
      unsigned char* wire = nullptr;
      size_t wireSize = 0;
      if (ares_dns_write(dnsResponse, &wire, &wireSize) == ARES_SUCCESS) {
        result.wireBytes = static_cast<double>(wireSize);
        ares_free_string(wire);
      }
      operation->completeSuccess(std::move(result));
    }

    void run() {
      ares_dns_record_t* request = nullptr;
      unsigned short requestFlags = ARES_FLAG_RD;
      if (query.dnssecOk) {
        requestFlags |= ARES_FLAG_CD;
      }
      auto status = ares_dns_record_create(&request, 0, requestFlags,
                                           ARES_OPCODE_QUERY,
                                           ARES_RCODE_NOERROR);
      const auto type = query.type == "AAAA" ? ARES_REC_TYPE_AAAA
                                             : ARES_REC_TYPE_A;
      if (status == ARES_SUCCESS) {
        status = ares_dns_record_query_add(request, query.name.c_str(), type,
                                           ARES_CLASS_IN);
      }
      if (status == ARES_SUCCESS && query.ednsUdpSize.has_value()) {
        ares_dns_rr_t* opt = nullptr;
        status = ares_dns_record_rr_add(
            &opt, request, ARES_SECTION_ADDITIONAL, "", ARES_REC_TYPE_OPT,
            ARES_CLASS_IN, 0);
        if (status == ARES_SUCCESS) {
          status = ares_dns_rr_set_u16(opt, ARES_RR_OPT_UDP_SIZE,
                                       *query.ednsUdpSize);
        }
        if (status == ARES_SUCCESS && query.dnssecOk) {
          status = ares_dns_rr_set_u16(opt, ARES_RR_OPT_FLAGS, 0x8000);
        }
      }
      if (status == ARES_SUCCESS) {
        status = ares_send_dnsrec(channel, request, &Operation::response, this,
                                  nullptr);
      }
      ares_dns_record_destroy(request);
      if (status != ARES_SUCCESS) {
        completeFailure(statusMessage(status));
      }

      while (true) {
        {
          std::lock_guard lock(stateMutex);
          if (finished) {
            break;
          }
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
      }
      ares_destroy(channel);
      channel = nullptr;
      auto service = std::move(owner);
      service->release(queryId);
    }

    void completeSuccess(Result result) {
      Success callback;
      {
        std::lock_guard lock(stateMutex);
        if (finished) {
          return;
        }
        finished = true;
        callback = success;
      }
      callback(std::move(result));
    }

    void completeFailure(std::string message) {
      Failure callback;
      {
        std::lock_guard lock(stateMutex);
        if (finished) {
          return;
        }
        finished = true;
        callback = failure;
      }
      callback(std::move(message));
    }
  };

  void initialize(Operation& operation) {
    if (operation.query.name.empty()) {
      throw std::invalid_argument("DNS name is required.");
    }
    if (operation.query.type != "A" && operation.query.type != "AAAA") {
      throw std::invalid_argument("Only A and AAAA Queries are supported.");
    }
    if (operation.query.transport != "auto" &&
        operation.query.transport != "udp" &&
        operation.query.transport != "tcp") {
      throw std::invalid_argument("DNS transport is invalid.");
    }
    if (operation.query.timeoutMs < 1 || operation.query.retries < 0) {
      throw std::invalid_argument("Timeout and retry values must be valid.");
    }

    ares_options options{};
    options.timeout = operation.query.timeoutMs;
    options.tries = operation.query.retries + 1;
    options.flags = ARES_FLAG_STAYOPEN | ARES_FLAG_NOCHECKRESP;
    if (operation.query.transport == "tcp") {
      options.flags |= ARES_FLAG_USEVC;
      operation.actualTransport = "tcp";
    }
    if (operation.query.ednsUdpSize.has_value()) {
      options.flags |= ARES_FLAG_EDNS;
      options.ednspsz = *operation.query.ednsUdpSize;
    }
    options.evsys = ARES_EVSYS_DEFAULT;
    auto optionMask = ARES_OPT_TIMEOUTMS | ARES_OPT_TRIES | ARES_OPT_FLAGS |
                      ARES_OPT_EVENT_THREAD;
    if (operation.query.ednsUdpSize.has_value()) {
      optionMask |= ARES_OPT_EDNSPSZ;
    }
    const auto status =
        ares_init_options(&operation.channel, &options, optionMask);
    if (status != ARES_SUCCESS) {
      throw std::runtime_error(statusMessage(status));
    }
    ares_set_server_state_callback(operation.channel, &Operation::serverState,
                                   &operation);

    if (operation.query.resolver.mode == Resolver::Mode::Custom) {
      if (!operation.query.resolver.address.has_value() ||
          !operation.query.resolver.port.has_value() ||
          *operation.query.resolver.port == 0) {
        ares_destroy(operation.channel);
        operation.channel = nullptr;
        throw std::invalid_argument(
            "Custom resolver address and port are required.");
      }
      const auto server = normalizeCustomServer(
          *operation.query.resolver.address, *operation.query.resolver.port);
      const auto serverStatus =
          ares_set_servers_ports_csv(operation.channel, server.c_str());
      if (serverStatus != ARES_SUCCESS) {
        ares_destroy(operation.channel);
        operation.channel = nullptr;
        throw std::invalid_argument(statusMessage(serverStatus));
      }
    }
  }

  void release(const std::string& queryId) {
    std::lock_guard lock(mutex_);
    const auto found = operations_.find(queryId);
    if (found == operations_.end()) {
      return;
    }
    operations_.erase(found);
  }

  std::mutex mutex_;
  std::unordered_map<std::string, std::shared_ptr<Operation>> operations_;
};

}  // namespace

std::shared_ptr<DnsService> makeCaresDnsService() {
  return std::make_shared<CaresDnsService>();
}

}  // namespace digger::dns
