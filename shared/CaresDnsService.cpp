#include "DnsService.h"

#if __has_include(<cares/ares.h>)
#include <cares/ares.h>
#else
#include <ares.h>
#endif
#include <arpa/inet.h>

#include <algorithm>
#include <array>
#include <chrono>
#include <cctype>
#include <cmath>
#include <condition_variable>
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

Failure statusFailure(int status, bool deadlineExpired = false) {
  if (deadlineExpired || status == ARES_ETIMEOUT) {
    return {FailureCode::Timeout,
            "No valid DNS response arrived before the Query deadline."};
  }
  switch (status) {
    case ARES_ECANCELLED:
      return {FailureCode::Cancelled, "The DNS Query was cancelled."};
    case ARES_ECONNREFUSED:
    case ARES_ENOSERVER:
    case ARES_EOF:
      return {FailureCode::NetworkUnavailable,
              "No DNS resolver is available on the current network."};
    case ARES_EBADRESP:
    case ARES_EFORMERR:
      return {FailureCode::InvalidResponse,
              "The resolver returned an invalid DNS response."};
    case ARES_EBADQUERY:
    case ARES_EBADNAME:
      return {FailureCode::InvalidInput, "The DNS Query is invalid."};
    default:
      return {FailureCode::InternalNative,
              std::string("The native DNS engine failed: ") +
                  ares_strerror(status)};
  }
}

class FailureException final : public std::runtime_error {
 public:
  explicit FailureException(Failure failure)
      : std::runtime_error(failure.message), failure_(std::move(failure)) {}

  const Failure& failure() const { return failure_; }

 private:
  Failure failure_;
};

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

std::string stringValue(const ares_dns_rr_t* record, ares_dns_rr_key_t key) {
  const auto* value = ares_dns_rr_get_str(record, key);
  return value == nullptr ? "" : canonicalName(value);
}

std::string hexadecimal(const unsigned char* value, size_t length) {
  static constexpr char digits[] = "0123456789abcdef";
  std::string result;
  result.reserve(length * 2);
  for (size_t index = 0; index < length; ++index) {
    result.push_back(digits[value[index] >> 4]);
    result.push_back(digits[value[index] & 0x0f]);
  }
  return result;
}

std::string textValue(const unsigned char* value, size_t length) {
  std::string result{"\""};
  for (size_t index = 0; index < length; ++index) {
    const auto character = value[index];
    if (character == '\\' || character == '"') {
      result.push_back('\\');
      result.push_back(static_cast<char>(character));
    } else if (std::isprint(character) != 0) {
      result.push_back(static_cast<char>(character));
    } else {
      result += "\\" + std::to_string(character);
    }
  }
  return result + '"';
}

std::string binaryTextValue(const ares_dns_rr_t* record, ares_dns_rr_key_t key) {
  size_t length = 0;
  const auto* value = ares_dns_rr_get_bin(record, key, &length);
  return value == nullptr ? "" : textValue(value, length);
}

std::string optionSummary(const ares_dns_rr_t* record, ares_dns_rr_key_t key) {
  std::vector<std::string> options;
  const auto count = ares_dns_rr_get_opt_cnt(record, key);
  for (size_t index = 0; index < count; ++index) {
    const unsigned char* value = nullptr;
    size_t length = 0;
    const auto option = ares_dns_rr_get_opt(record, key, index, &value, &length);
    const auto* optionName = ares_dns_opt_get_name(key, option);
    options.push_back(std::string(optionName == nullptr ? "key" : optionName) +
                      "=" + (value == nullptr ? "" : hexadecimal(value, length)));
  }
  if (options.empty()) {
    return "";
  }
  std::ostringstream result;
  result << " · params: ";
  for (size_t index = 0; index < options.size(); ++index) {
    if (index != 0) {
      result << ", ";
    }
    result << options[index];
  }
  return result.str();
}

std::string recordData(const ares_dns_rr_t* record) {
  char buffer[INET6_ADDRSTRLEN] = {};
  const auto name = [](const char* label, const std::string& value) {
    return std::string(label) + ": " + value;
  };
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
    case ARES_REC_TYPE_CNAME:
      return name("cname", stringValue(record, ARES_RR_CNAME_CNAME));
    case ARES_REC_TYPE_NS:
      return name("host", stringValue(record, ARES_RR_NS_NSDNAME));
    case ARES_REC_TYPE_PTR:
      return name("ptrdname", stringValue(record, ARES_RR_PTR_DNAME));
    case ARES_REC_TYPE_MX:
      return "preference: " +
             std::to_string(ares_dns_rr_get_u16(record, ARES_RR_MX_PREFERENCE)) +
             " · exchange: " + stringValue(record, ARES_RR_MX_EXCHANGE);
    case ARES_REC_TYPE_TXT: {
      std::vector<std::string> texts;
      const auto count = ares_dns_rr_get_abin_cnt(record, ARES_RR_TXT_DATA);
      for (size_t index = 0; index < count; ++index) {
        size_t length = 0;
        const auto* value =
            ares_dns_rr_get_abin(record, ARES_RR_TXT_DATA, index, &length);
        if (value != nullptr) {
          texts.push_back(textValue(value, length));
        }
      }
      std::ostringstream result;
      for (size_t index = 0; index < texts.size(); ++index) {
        if (index != 0) {
          result << " · ";
        }
        result << texts[index];
      }
      return result.str();
    }
    case ARES_REC_TYPE_SOA:
      return "mname: " + stringValue(record, ARES_RR_SOA_MNAME) +
             " · rname: " + stringValue(record, ARES_RR_SOA_RNAME) +
             " · serial: " +
             std::to_string(ares_dns_rr_get_u32(record, ARES_RR_SOA_SERIAL)) +
             " · refresh: " +
             std::to_string(ares_dns_rr_get_u32(record, ARES_RR_SOA_REFRESH)) +
             " · retry: " +
             std::to_string(ares_dns_rr_get_u32(record, ARES_RR_SOA_RETRY)) +
             " · expire: " +
             std::to_string(ares_dns_rr_get_u32(record, ARES_RR_SOA_EXPIRE)) +
             " · minimum: " +
             std::to_string(ares_dns_rr_get_u32(record, ARES_RR_SOA_MINIMUM));
    case ARES_REC_TYPE_SRV:
      return "priority: " +
             std::to_string(ares_dns_rr_get_u16(record, ARES_RR_SRV_PRIORITY)) +
             " · weight: " +
             std::to_string(ares_dns_rr_get_u16(record, ARES_RR_SRV_WEIGHT)) +
             " · port: " +
             std::to_string(ares_dns_rr_get_u16(record, ARES_RR_SRV_PORT)) +
             " · target: " + stringValue(record, ARES_RR_SRV_TARGET);
    case ARES_REC_TYPE_CAA:
      return "critical: " +
             std::to_string(ares_dns_rr_get_u8(record, ARES_RR_CAA_CRITICAL)) +
             " · tag: " + (ares_dns_rr_get_str(record, ARES_RR_CAA_TAG) == nullptr
                                  ? ""
                                  : ares_dns_rr_get_str(record, ARES_RR_CAA_TAG)) +
             " · value: " + binaryTextValue(record, ARES_RR_CAA_VALUE);
    case ARES_REC_TYPE_SVCB:
      return "priority: " +
             std::to_string(ares_dns_rr_get_u16(record, ARES_RR_SVCB_PRIORITY)) +
             " · target: " + stringValue(record, ARES_RR_SVCB_TARGET) +
             optionSummary(record, ARES_RR_SVCB_PARAMS);
    case ARES_REC_TYPE_HTTPS:
      return "priority: " +
             std::to_string(ares_dns_rr_get_u16(record, ARES_RR_HTTPS_PRIORITY)) +
             " · target: " + stringValue(record, ARES_RR_HTTPS_TARGET) +
             optionSummary(record, ARES_RR_HTTPS_PARAMS);
    case ARES_REC_TYPE_RAW_RR: {
      size_t length = 0;
      const auto* value =
          ares_dns_rr_get_bin(record, ARES_RR_RAW_RR_DATA, &length);
      return "RDATA: " + (value == nullptr ? "" : hexadecimal(value, length));
    }
    default:
      return "";
  }
}

std::string recordType(const ares_dns_rr_t* record) {
  if (ares_dns_rr_get_type(record) == ARES_REC_TYPE_RAW_RR) {
    return "TYPE" +
           std::to_string(ares_dns_rr_get_u16(record, ARES_RR_RAW_RR_TYPE));
  }
  return typeName(ares_dns_rr_get_type(record));
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
                      recordType(record),
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

std::optional<ares_dns_rec_type_t> supportedRecordType(const std::string& type) {
  static const std::array<std::string, 12> supported = {
      "A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "PTR",
      "SRV", "CAA", "HTTPS", "SVCB"};
  if (std::find(supported.begin(), supported.end(), type) == supported.end()) {
    return std::nullopt;
  }
  ares_dns_rec_type_t result{};
  return ares_dns_rec_type_fromstr(&result, type.c_str()) ? std::optional{result}
                                                           : std::nullopt;
}

bool validDnsName(const std::string& name) {
  if (name.empty() || name.size() > 253 || name.find_first_of("/:?# ") != std::string::npos) {
    return false;
  }
  const auto end = name.back() == '.' ? name.size() - 1 : name.size();
  if (end == 0) {
    return true;
  }
  size_t labelStart = 0;
  while (labelStart < end) {
    const auto labelEnd = name.find('.', labelStart);
    const auto length = (labelEnd == std::string::npos ? end : labelEnd) - labelStart;
    if (length == 0 || length > 63 || name[labelStart] == '-' ||
        name[labelStart + length - 1] == '-') {
      return false;
    }
    for (size_t index = labelStart; index < labelStart + length; ++index) {
      const auto character = static_cast<unsigned char>(name[index]);
      if (!std::isalnum(character) && character != '-' && character != '_') {
        return false;
      }
    }
    labelStart += length + 1;
  }
  return true;
}

void normalizePtrAddress(Query& query) {
  if (query.type != "PTR") {
    return;
  }
  ares_addr address{};
  address.family = AF_UNSPEC;
  size_t length = 0;
  if (ares_dns_pton(query.name.c_str(), &address, &length) == nullptr) {
    return;
  }
  char* reverseName = ares_dns_addr_to_ptr(&address);
  if (reverseName != nullptr) {
    query.name = reverseName;
    ares_free_string(reverseName);
  }
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
  throw FailureException(
      {FailureCode::InvalidInput,
       "Custom resolver address must be a valid IPv4 or IPv6 address."});
}

class CaresDnsService final
    : public DnsService,
      public std::enable_shared_from_this<CaresDnsService> {
 public:
  CaresDnsService() {
    const auto status = ares_library_init(ARES_LIB_INIT_ALL);
    if (status != ARES_SUCCESS) {
      throw FailureException(statusFailure(status));
    }
  }

  ~CaresDnsService() override { ares_library_cleanup(); }

  void query(std::string queryId, Query query, Success success,
             FailureCallback failure) override {
    auto operation = std::make_shared<Operation>();
    operation->owner = shared_from_this();
    operation->queryId = std::move(queryId);
    operation->query = std::move(query);
    operation->success = std::move(success);
    operation->failure = std::move(failure);
    operation->started = Clock::now();

    bool duplicateIdentifier = false;
    {
      std::lock_guard lock(mutex_);
      if (operations_.contains(operation->queryId)) {
        duplicateIdentifier = true;
      } else {
        operations_[operation->queryId] = operation;
      }
    }
    if (duplicateIdentifier) {
      operation->failure(
          {FailureCode::InvalidInput,
           "A DNS Query with this identifier is already active."});
      return;
    }

    try {
      std::thread([operation] { operation->run(); }).detach();
    } catch (const std::exception&) {
      release(operation->queryId, operation.get());
      operation->failure(
          {FailureCode::InternalNative,
           "The native DNS engine could not start the Query worker."});
    }
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
    operation->cancel();
  }

 private:
  struct Operation {
    std::shared_ptr<CaresDnsService> owner;
    std::string queryId;
    Query query;
    Success success;
    FailureCallback failure;
    ares_channel_t* channel{};
    Clock::time_point started;
    Clock::time_point deadline;
    std::mutex stateMutex;
    std::condition_variable stateCondition;
    bool callbackStarted{false};
    bool callbackReturned{false};
    bool cancellationRequested{false};
    bool querySubmitted{false};
    bool deadlineExpired{false};
    std::string actualTransport{"udp"};

    std::mutex channelMutex;
    std::condition_variable channelCondition;
    size_t channelUsers{0};
    bool destroyingChannel{false};

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
        bool expired;
        {
          std::lock_guard lock(operation->stateMutex);
          expired = operation->deadlineExpired;
        }
        operation->completeFailure(statusFailure(status, expired));
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
      try {
        owner->initialize(*this);
      } catch (const FailureException& error) {
        completeFailure(error.failure());
      } catch (const std::exception&) {
        completeFailure(
            {FailureCode::InternalNative,
             "The native DNS engine could not initialize the Query."});
      }

      bool shouldSubmit = false;
      bool cancelledBeforeSubmission = false;
      bool expiredBeforeSubmission = false;
      {
        std::lock_guard lock(stateMutex);
        if (!callbackStarted) {
          cancelledBeforeSubmission = cancellationRequested;
          expiredBeforeSubmission = Clock::now() >= deadline;
          shouldSubmit =
              !cancelledBeforeSubmission && !expiredBeforeSubmission;
          deadlineExpired = expiredBeforeSubmission;
        }
      }
      if (cancelledBeforeSubmission) {
        completeFailure(
            {FailureCode::Cancelled, "The DNS Query was cancelled."});
      } else if (expiredBeforeSubmission) {
        completeFailure(statusFailure(ARES_ETIMEOUT, true));
      }

      ares_dns_record_t* request = nullptr;
      auto status = shouldSubmit
          ? ares_dns_record_create(&request, 0, ARES_FLAG_RD,
                                   ARES_OPCODE_QUERY, ARES_RCODE_NOERROR)
          : ARES_ECANCELLED;
      const auto type = supportedRecordType(query.type);
      if (status == ARES_SUCCESS && type.has_value()) {
        status = ares_dns_record_query_add(request, query.name.c_str(), *type,
                                           ARES_CLASS_IN);
      } else if (status == ARES_SUCCESS) {
        status = ARES_EBADQUERY;
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
        if (status == ARES_SUCCESS) {
          status = ares_dns_rr_set_u8(opt, ARES_RR_OPT_VERSION, 0);
        }
        if (status == ARES_SUCCESS) {
          status = ares_dns_rr_set_u16(opt, ARES_RR_OPT_FLAGS,
                                       query.dnssecOk ? 0x8000 : 0);
        }
      }
      if (status == ARES_SUCCESS) {
        bool cancelled;
        {
          std::lock_guard lock(stateMutex);
          cancelled = cancellationRequested;
        }
        status = cancelled
            ? ARES_ECANCELLED
            : ares_send_dnsrec(channel, request, &Operation::response, this,
                               nullptr);
      }
      if (request != nullptr) {
        ares_dns_record_destroy(request);
      }
      if (status != ARES_SUCCESS) {
        completeFailure(statusFailure(status));
      }

      bool shouldCancel = false;
      {
        std::lock_guard lock(stateMutex);
        querySubmitted = status == ARES_SUCCESS;
        shouldCancel = cancellationRequested && querySubmitted;
      }
      if (shouldCancel) {
        completeFailure(
            {FailureCode::Cancelled, "The DNS Query was cancelled."});
        cancelChannel();
      }

      bool shouldExpire = false;
      {
        std::unique_lock lock(stateMutex);
        if (!stateCondition.wait_until(
                lock, deadline, [this] { return callbackStarted; })) {
          deadlineExpired = true;
          shouldExpire = true;
        }
      }
      if (shouldExpire) {
        completeFailure(statusFailure(ARES_ETIMEOUT, true));
        cancelChannel();
      }
      {
        std::unique_lock lock(stateMutex);
        stateCondition.wait(lock, [this] { return callbackReturned; });
      }

      auto service = owner;
      service->release(queryId, this);
      destroyChannel();
      owner.reset();
    }

    void cancel() {
      bool shouldCancelChannel;
      {
        std::lock_guard lock(stateMutex);
        if (callbackStarted) {
          return;
        }
        cancellationRequested = true;
        shouldCancelChannel = querySubmitted;
      }
      completeFailure(
          {FailureCode::Cancelled, "The DNS Query was cancelled."});
      if (shouldCancelChannel) {
        cancelChannel();
      }
    }

    void cancelChannel() {
      ares_channel_t* activeChannel;
      {
        std::lock_guard lock(channelMutex);
        if (destroyingChannel || channel == nullptr) {
          return;
        }
        ++channelUsers;
        activeChannel = channel;
      }
      ares_cancel(activeChannel);
      {
        std::lock_guard lock(channelMutex);
        --channelUsers;
        if (channelUsers == 0) {
          channelCondition.notify_all();
        }
      }
    }

    void destroyChannel() {
      ares_channel_t* channelToDestroy;
      {
        std::unique_lock lock(channelMutex);
        destroyingChannel = true;
        channelCondition.wait(lock, [this] { return channelUsers == 0; });
        channelToDestroy = std::exchange(channel, nullptr);
      }
      if (channelToDestroy != nullptr) {
        ares_destroy(channelToDestroy);
      }
    }

    void completeSuccess(Result result) {
      Success callback;
      {
        std::lock_guard lock(stateMutex);
        if (callbackStarted) {
          return;
        }
        callbackStarted = true;
        callback = success;
      }
      stateCondition.notify_all();
      try {
        callback(std::move(result));
      } catch (...) {
      }
      callbackFinished();
    }

    void completeFailure(Failure queryFailure) {
      FailureCallback callback;
      {
        std::lock_guard lock(stateMutex);
        if (callbackStarted) {
          return;
        }
        callbackStarted = true;
        callback = failure;
      }
      stateCondition.notify_all();
      try {
        callback(std::move(queryFailure));
      } catch (...) {
      }
      callbackFinished();
    }

    void callbackFinished() {
      {
        std::lock_guard lock(stateMutex);
        callbackReturned = true;
      }
      stateCondition.notify_all();
    }
  };

  void initialize(Operation& operation) {
    if (operation.queryId.empty()) {
      throw FailureException(
          {FailureCode::InvalidInput, "A Query identifier is required."});
    }
    normalizePtrAddress(operation.query);
    if (!validDnsName(operation.query.name)) {
      throw FailureException(
          {FailureCode::InvalidInput, "A valid DNS name is required."});
    }
    if (!supportedRecordType(operation.query.type).has_value()) {
      throw FailureException(
          {FailureCode::InvalidInput, "The requested record type is not supported."});
    }
    if (operation.query.transport != "auto" &&
        operation.query.transport != "udp" &&
        operation.query.transport != "tcp") {
      throw FailureException(
          {FailureCode::InvalidInput, "DNS transport is invalid."});
    }
    if (operation.query.timeoutMs < 250 ||
        operation.query.timeoutMs > 120000 || operation.query.retries < 0 ||
        operation.query.retries > 10) {
      throw FailureException(
          {FailureCode::InvalidInput,
           "Timeout must be 250–120000 ms and retries must be 0–10."});
    }
    if (operation.query.ednsUdpSize.has_value() &&
        *operation.query.ednsUdpSize < 512) {
      throw FailureException(
          {FailureCode::InvalidInput,
           "EDNS UDP size must be at least 512 bytes."});
    }
    if (operation.query.dnssecOk &&
        !operation.query.ednsUdpSize.has_value()) {
      throw FailureException(
          {FailureCode::InvalidInput,
           "DNSSEC OK requires EDNS to be enabled."});
    }

    std::optional<std::string> customServer;
    if (operation.query.resolver.mode == Resolver::Mode::Custom) {
      if (!operation.query.resolver.address.has_value() ||
          !operation.query.resolver.port.has_value() ||
          *operation.query.resolver.port == 0) {
        throw FailureException(
            {FailureCode::InvalidInput,
             "Custom resolver address and port are required."});
      }
      customServer = normalizeCustomServer(
          *operation.query.resolver.address, *operation.query.resolver.port);
    }

    ares_options options{};
    options.timeout = operation.query.timeoutMs;
    options.maxtimeout = operation.query.timeoutMs;
    options.tries = operation.query.retries + 1;
    options.flags = ARES_FLAG_STAYOPEN | ARES_FLAG_NOCHECKRESP;
    if (operation.query.transport == "tcp") {
      options.flags |= ARES_FLAG_USEVC;
      operation.actualTransport = "tcp";
    }
    options.evsys = ARES_EVSYS_DEFAULT;
    const auto optionMask = ARES_OPT_TIMEOUTMS | ARES_OPT_MAXTIMEOUTMS |
                            ARES_OPT_TRIES | ARES_OPT_FLAGS |
                            ARES_OPT_EVENT_THREAD;
    const auto status =
        ares_init_options(&operation.channel, &options, optionMask);
    if (status != ARES_SUCCESS) {
      throw FailureException(statusFailure(status));
    }
    ares_set_server_state_callback(operation.channel, &Operation::serverState,
                                   &operation);

    if (customServer.has_value()) {
      const auto serverStatus = ares_set_servers_ports_csv(
          operation.channel, customServer->c_str());
      if (serverStatus != ARES_SUCCESS) {
        operation.destroyChannel();
        throw FailureException(statusFailure(serverStatus));
      }
    }

    const auto attempts = static_cast<long long>(operation.query.retries) + 1;
    const auto totalMs =
        std::max<long long>(1, operation.query.timeoutMs * attempts);
    operation.deadline =
        operation.started + std::chrono::milliseconds(totalMs);
  }

  void release(const std::string& queryId, const Operation* operation) {
    std::lock_guard lock(mutex_);
    const auto found = operations_.find(queryId);
    if (found == operations_.end() || found->second.get() != operation) {
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
