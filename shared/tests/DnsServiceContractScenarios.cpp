#include "DnsServiceContractScenarios.h"

#include "DnsService.h"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <poll.h>
#include <sys/socket.h>
#include <unistd.h>

#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace digger::dns::testing {
namespace {

using namespace std::chrono_literals;

enum class ServerBehavior {
  Answer,
  DropFirstThenAnswer,
  DelayedAnswer,
  Ignore,
  TruncateUdp,
  Malformed,
  NxDomain,
  ServFail,
  Refused,
};

struct RequestObservation {
  int udpCount{0};
  int tcpCount{0};
  bool hasEdns{false};
  unsigned short ednsUdpSize{0};
  bool dnssecOk{false};
  bool checkingDisabled{false};
};

void require(bool condition, const std::string& message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

size_t questionEnd(const uint8_t* packet, size_t size) {
  size_t index = 12;
  while (index < size && packet[index] != 0) {
    const auto labelLength = static_cast<size_t>(packet[index]);
    if (labelLength > 63 || index + labelLength + 1 >= size) {
      throw std::runtime_error("invalid controlled Query name");
    }
    index += labelLength + 1;
  }
  if (index + 5 > size) {
    throw std::runtime_error("short controlled Query");
  }
  return index + 5;
}

uint16_t queryType(const std::vector<uint8_t>& packet) {
  const auto end = questionEnd(packet.data(), packet.size());
  return static_cast<uint16_t>((packet[end - 4] << 8) | packet[end - 3]);
}

void appendU16(std::vector<uint8_t>& buffer, uint16_t value) {
  buffer.push_back(static_cast<uint8_t>(value >> 8));
  buffer.push_back(static_cast<uint8_t>(value));
}

void appendU32(std::vector<uint8_t>& buffer, uint32_t value) {
  buffer.push_back(static_cast<uint8_t>(value >> 24));
  buffer.push_back(static_cast<uint8_t>(value >> 16));
  buffer.push_back(static_cast<uint8_t>(value >> 8));
  buffer.push_back(static_cast<uint8_t>(value));
}

void appendName(std::vector<uint8_t>& buffer, const std::string& name) {
  size_t start = 0;
  while (start < name.size()) {
    const auto end = name.find('.', start);
    const auto length = (end == std::string::npos ? name.size() : end) - start;
    if (length == 0) {
      break;
    }
    buffer.push_back(static_cast<uint8_t>(length));
    buffer.insert(buffer.end(), name.begin() + static_cast<long>(start),
                  name.begin() + static_cast<long>(start + length));
    start += length + 1;
  }
  buffer.push_back(0);
}

std::vector<uint8_t> rdataFor(uint16_t type, uint8_t answerByte) {
  std::vector<uint8_t> data;
  switch (type) {
    case 1:
      return {192, 0, 2, answerByte};
    case 28: {
      const std::array<uint8_t, 16> ipv6 = {
          0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0,
          0,    0,    0,    0,    0, 0, 0,
          static_cast<uint8_t>(((answerByte / 10) << 4) | (answerByte % 10))};
      return {ipv6.begin(), ipv6.end()};
    }
    case 2:
    case 5:
    case 12:
      appendName(data, "target.example.");
      return data;
    case 15:
      appendU16(data, 10);
      appendName(data, "mail.example.");
      return data;
    case 16:
      data.insert(data.end(), {5, 'h', 'e', 'l', 'l', 'o', 5, 'w', 'o', 'r', 'l', 'd'});
      return data;
    case 6:
      appendName(data, "ns1.example.");
      appendName(data, "hostmaster.example.");
      appendU32(data, 20260814);
      appendU32(data, 3600);
      appendU32(data, 600);
      appendU32(data, 1209600);
      appendU32(data, 300);
      return data;
    case 33:
      appendU16(data, 10);
      appendU16(data, 20);
      appendU16(data, 443);
      appendName(data, "service.example.");
      return data;
    case 257:
      data.insert(data.end(), {0, 5, 'i', 's', 's', 'u', 'e'});
      data.insert(data.end(), {'l', 'e', 't', 's', 'e', 'n', 'c', 'r', 'y', 'p', 't', '.', 'o', 'r', 'g'});
      return data;
    case 64:
    case 65:
      appendU16(data, 1);
      appendName(data, "service.example.");
      return data;
    default:
      return {0xde, 0xad, 0xbe, 0xef};
  }
}

std::vector<uint8_t> answerResponse(const std::vector<uint8_t>& request,
                                    uint8_t answerByte, bool authenticated) {
  const auto end = questionEnd(request.data(), request.size());
  const auto type = queryType(request);
  std::vector<uint8_t> response(request.begin(), request.begin() + end);
  response[2] = 0x81;
  response[3] = static_cast<uint8_t>(0x80 | (authenticated ? 0x20 : 0));
  response[4] = 0;
  response[5] = 1;
  response[6] = 0;
  response[7] = 1;
  response[8] = 0;
  response[9] = 1;
  response[10] = 0;
  response[11] = 1;
  const auto appendRecord = [&response](uint16_t recordType,
                                        const std::vector<uint8_t>& data) {
    response.insert(response.end(),
                    {0xc0, 0x0c, static_cast<uint8_t>(recordType >> 8),
                     static_cast<uint8_t>(recordType), 0, 1, 0, 0, 0, 60});
    appendU16(response, static_cast<uint16_t>(data.size()));
    response.insert(response.end(), data.begin(), data.end());
  };
  appendRecord(type, rdataFor(type, answerByte));
  appendRecord(2, rdataFor(2, answerByte));
  appendRecord(65400, rdataFor(65400, answerByte));
  return response;
}

std::vector<uint8_t> responseCode(const std::vector<uint8_t>& request,
                                  uint8_t rcode) {
  const auto end = questionEnd(request.data(), request.size());
  std::vector<uint8_t> response(request.begin(), request.begin() + end);
  response[2] = 0x81;
  response[3] = static_cast<uint8_t>(0x80 | rcode);
  std::fill(response.begin() + 6, response.begin() + 12, 0);
  response[4] = 0;
  response[5] = 1;
  return response;
}

std::vector<uint8_t> truncatedResponse(const std::vector<uint8_t>& request) {
  const auto end = questionEnd(request.data(), request.size());
  std::vector<uint8_t> response(request.begin(), request.begin() + end);
  response[2] = 0x83;
  response[3] = 0x80;
  std::fill(response.begin() + 6, response.begin() + 12, 0);
  response[4] = 0;
  response[5] = 1;
  return response;
}

std::vector<uint8_t> malformedResponse(const std::vector<uint8_t>& request) {
  auto response = answerResponse(request, 44, false);
  const auto answerOffset = questionEnd(response.data(), response.size());
  response[answerOffset] = 0xc0;
  response[answerOffset + 1] = static_cast<uint8_t>(answerOffset);
  return response;
}

bool receiveAll(int socket, uint8_t* data, size_t size) {
  size_t received = 0;
  while (received < size) {
    const auto count = recv(socket, data + received, size - received, 0);
    if (count <= 0) {
      return false;
    }
    received += static_cast<size_t>(count);
  }
  return true;
}

bool sendAll(int socket, const uint8_t* data, size_t size) {
  size_t sent = 0;
  while (sent < size) {
    const auto count = send(socket, data + sent, size - sent, 0);
    if (count <= 0) {
      return false;
    }
    sent += static_cast<size_t>(count);
  }
  return true;
}

class ControlledDnsServer {
 public:
  explicit ControlledDnsServer(int family,
                               ServerBehavior behavior = ServerBehavior::Answer,
                               uint8_t answerByte = 44,
                               bool authenticated = false)
      : behavior_(behavior),
        answerByte_(answerByte),
        authenticated_(authenticated) {
    udpSocket_ = socket(family, SOCK_DGRAM, 0);
    tcpSocket_ = socket(family, SOCK_STREAM, 0);
    if (udpSocket_ < 0 || tcpSocket_ < 0) {
      throw std::runtime_error("controlled server socket failed");
    }

    int reuse = 1;
    setsockopt(tcpSocket_, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
    if (family == AF_INET) {
      sockaddr_in address{};
      address.sin_family = AF_INET;
      address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
      require(bind(udpSocket_, reinterpret_cast<sockaddr*>(&address),
                   sizeof(address)) == 0,
              "IPv4 UDP bind failed");
      socklen_t length = sizeof(address);
      require(getsockname(udpSocket_, reinterpret_cast<sockaddr*>(&address),
                          &length) == 0,
              "IPv4 getsockname failed");
      port_ = ntohs(address.sin_port);
      address_ = "127.0.0.1";
      require(bind(tcpSocket_, reinterpret_cast<sockaddr*>(&address),
                   sizeof(address)) == 0,
              "IPv4 TCP bind failed");
    } else {
      sockaddr_in6 address{};
      address.sin6_family = AF_INET6;
      address.sin6_addr = in6addr_loopback;
      require(bind(udpSocket_, reinterpret_cast<sockaddr*>(&address),
                   sizeof(address)) == 0,
              "IPv6 UDP bind failed");
      socklen_t length = sizeof(address);
      require(getsockname(udpSocket_, reinterpret_cast<sockaddr*>(&address),
                          &length) == 0,
              "IPv6 getsockname failed");
      port_ = ntohs(address.sin6_port);
      address_ = "::1";
      require(bind(tcpSocket_, reinterpret_cast<sockaddr*>(&address),
                   sizeof(address)) == 0,
              "IPv6 TCP bind failed");
    }
    require(listen(tcpSocket_, 4) == 0, "controlled TCP listen failed");
    udpWorker_ = std::thread([this] { serveUdp(); });
    tcpWorker_ = std::thread([this] { serveTcp(); });
  }

  ~ControlledDnsServer() {
    stop_ = true;
    shutdown(udpSocket_, SHUT_RDWR);
    shutdown(tcpSocket_, SHUT_RDWR);
    close(udpSocket_);
    close(tcpSocket_);
    if (udpWorker_.joinable()) {
      udpWorker_.join();
    }
    if (tcpWorker_.joinable()) {
      tcpWorker_.join();
    }
  }

  const std::string& address() const { return address_; }
  unsigned short port() const { return port_; }

  RequestObservation observation() const {
    std::lock_guard lock(observationMutex_);
    return observation_;
  }

  bool waitForRequests(int count, std::chrono::milliseconds timeout = 1s) {
    const auto deadline = std::chrono::steady_clock::now() + timeout;
    while (std::chrono::steady_clock::now() < deadline) {
      const auto value = observation();
      if (value.udpCount + value.tcpCount >= count) {
        return true;
      }
      std::this_thread::sleep_for(2ms);
    }
    return false;
  }

 private:
  void observe(const std::vector<uint8_t>& request, bool tcp) {
    const auto end = questionEnd(request.data(), request.size());
    std::lock_guard lock(observationMutex_);
    if (tcp) {
      ++observation_.tcpCount;
    } else {
      ++observation_.udpCount;
    }
    observation_.checkingDisabled = (request[3] & 0x10) != 0;
    const auto additionalCount =
        static_cast<uint16_t>((request[10] << 8) | request[11]);
    if (additionalCount > 0 && end + 11 <= request.size() &&
        request[end] == 0 && request[end + 1] == 0 &&
        request[end + 2] == 41) {
      observation_.hasEdns = true;
      observation_.ednsUdpSize = static_cast<unsigned short>(
          (request[end + 3] << 8) | request[end + 4]);
      observation_.dnssecOk = (request[end + 7] & 0x80) != 0;
    }
  }

  std::vector<uint8_t> responseFor(const std::vector<uint8_t>& request,
                                   bool tcp, int requestNumber) const {
    if (behavior_ == ServerBehavior::Ignore ||
        (behavior_ == ServerBehavior::DropFirstThenAnswer &&
         requestNumber == 1)) {
      return {};
    }
    if (behavior_ == ServerBehavior::DelayedAnswer) {
      std::this_thread::sleep_for(75ms);
    }
    if (behavior_ == ServerBehavior::TruncateUdp && !tcp) {
      return truncatedResponse(request);
    }
    if (behavior_ == ServerBehavior::Malformed) {
      return malformedResponse(request);
    }
    if (behavior_ == ServerBehavior::NxDomain) {
      return responseCode(request, 3);
    }
    if (behavior_ == ServerBehavior::ServFail) {
      return responseCode(request, 2);
    }
    if (behavior_ == ServerBehavior::Refused) {
      return responseCode(request, 5);
    }
    return answerResponse(request, answerByte_, authenticated_);
  }

  void serveUdp() {
    while (!stop_) {
      pollfd descriptor{udpSocket_, POLLIN, 0};
      if (poll(&descriptor, 1, 50) <= 0 || !(descriptor.revents & POLLIN)) {
        continue;
      }
      std::array<uint8_t, 4096> buffer{};
      sockaddr_storage peer{};
      socklen_t peerLength = sizeof(peer);
      const auto length = recvfrom(
          udpSocket_, buffer.data(), buffer.size(), 0,
          reinterpret_cast<sockaddr*>(&peer), &peerLength);
      if (length <= 0) {
        continue;
      }
      std::vector<uint8_t> request(buffer.begin(), buffer.begin() + length);
      observe(request, false);
      const auto requestNumber = observation().udpCount;
      const auto response = responseFor(request, false, requestNumber);
      if (!response.empty()) {
        sendto(udpSocket_, response.data(), response.size(), 0,
               reinterpret_cast<sockaddr*>(&peer), peerLength);
      }
    }
  }

  void serveTcp() {
    while (!stop_) {
      pollfd descriptor{tcpSocket_, POLLIN, 0};
      if (poll(&descriptor, 1, 50) <= 0 || !(descriptor.revents & POLLIN)) {
        continue;
      }
      const auto client = accept(tcpSocket_, nullptr, nullptr);
      if (client < 0) {
        continue;
      }
      std::array<uint8_t, 2> lengthBytes{};
      if (!receiveAll(client, lengthBytes.data(), lengthBytes.size())) {
        close(client);
        continue;
      }
      const auto length = static_cast<size_t>((lengthBytes[0] << 8) |
                                              lengthBytes[1]);
      std::vector<uint8_t> request(length);
      if (!receiveAll(client, request.data(), request.size())) {
        close(client);
        continue;
      }
      observe(request, true);
      const auto requestNumber = observation().tcpCount;
      const auto response = responseFor(request, true, requestNumber);
      if (!response.empty()) {
        const std::array<uint8_t, 2> responseLength = {
            static_cast<uint8_t>(response.size() >> 8),
            static_cast<uint8_t>(response.size())};
        sendAll(client, responseLength.data(), responseLength.size());
        sendAll(client, response.data(), response.size());
      }
      close(client);
    }
  }

  ServerBehavior behavior_;
  uint8_t answerByte_;
  bool authenticated_;
  int udpSocket_{-1};
  int tcpSocket_{-1};
  unsigned short port_{};
  std::string address_;
  std::atomic<bool> stop_{false};
  std::thread udpWorker_;
  std::thread tcpWorker_;
  mutable std::mutex observationMutex_;
  RequestObservation observation_;
};

struct QueryCompletion {
  std::mutex mutex;
  std::condition_variable condition;
  bool completed{false};
  std::optional<Result> result;
  std::optional<Failure> failure;

  DnsService::Success success() {
    return [this](Result value) {
      std::lock_guard lock(mutex);
      result = std::move(value);
      completed = true;
      condition.notify_one();
    };
  }

  DnsService::FailureCallback failed() {
    return [this](Failure value) {
      std::lock_guard lock(mutex);
      failure = std::move(value);
      completed = true;
      condition.notify_one();
    };
  }

  void wait(std::chrono::milliseconds timeout = 3s) {
    std::unique_lock lock(mutex);
    require(condition.wait_for(lock, timeout, [this] { return completed; }),
            "controlled Query did not complete");
  }
};

Query customQuery(const ControlledDnsServer& server,
                  const std::string& type = "A",
                  const std::string& transport = "udp") {
  Query query;
  query.name = "controlled.test";
  query.type = type;
  query.resolver.mode = Resolver::Mode::Custom;
  query.resolver.address = server.address();
  query.resolver.port = server.port();
  query.transport = transport;
  query.timeoutMs = 250;
  query.retries = 0;
  query.ednsUdpSize = 1232;
  return query;
}

Result successful(QueryCompletion& completion) {
  completion.wait();
  require(!completion.failure.has_value(),
          completion.failure.has_value() ? completion.failure->message
                                         : "Query failed");
  require(completion.result.has_value(), "Query omitted its Result");
  return std::move(*completion.result);
}

Failure failed(QueryCompletion& completion) {
  completion.wait();
  require(!completion.result.has_value(), "failed Query returned a Result");
  require(completion.failure.has_value(), "failed Query omitted its failure");
  return std::move(*completion.failure);
}

void start(const std::shared_ptr<DnsService>& service, std::string queryId,
           Query query, QueryCompletion& completion) {
  service->query(std::move(queryId), std::move(query), completion.success(),
                 completion.failed());
}

void customResolverContract(int family, const std::string& type,
                            const std::string& expected) {
  ControlledDnsServer server(family);
  auto service = makeCaresDnsService();
  auto query = customQuery(server, type, "udp");
  QueryCompletion completion;
  start(service, "address-" + server.address() + "-" + type, query,
        completion);
  const auto result = successful(completion);

  require(result.rcode == "NOERROR", "unexpected response code");
  require(result.answer.size() == 1, "answer section was not parsed");
  require(result.answer[0].type == type, "record type was not preserved");
  require(result.answer[0].data == expected, "record address was not parsed");
  require(result.question.size() == 1, "question section was not parsed");
  require(result.server.has_value(), "custom server endpoint was omitted");
  require(result.server->address == server.address(),
          "custom server address changed");
  require(result.server->port == server.port(), "custom server port changed");
  require(result.transport == "udp", "UDP transport was not reported");
  require(result.elapsedMs >= 0, "elapsed time was not reported");
  require(result.wireBytes > 0, "wire size was not reported");
}

void completeResultContract() {
  ControlledDnsServer server(AF_INET);
  auto service = makeCaresDnsService();
  QueryCompletion completion;
  start(service, "all-sections", customQuery(server), completion);
  const auto result = successful(completion);
  require(result.question.size() == 1, "question section was omitted");
  require(result.answer.size() == 1, "answer section was omitted");
  require(result.authority.size() == 1, "authority section was omitted");
  require(result.additional.size() == 1, "additional section was omitted");
  require(result.additional[0].type == "TYPE65400", "unknown type was discarded");
  require(result.additional[0].data == "RDATA: deadbeef",
          "unknown RDATA was not rendered as hexadecimal");
}

void responseCodesContract() {
  for (const auto& [behavior, expected] :
       std::vector<std::pair<ServerBehavior, std::string>>{
           {ServerBehavior::NxDomain, "NXDOMAIN"},
           {ServerBehavior::ServFail, "SERVFAIL"},
           {ServerBehavior::Refused, "REFUSED"}}) {
    ControlledDnsServer server(AF_INET, behavior);
    auto service = makeCaresDnsService();
    QueryCompletion completion;
    start(service, "rcode-" + expected, customQuery(server), completion);
    const auto result = successful(completion);
    require(result.rcode == expected, expected + " was not returned as a Result");
    require(result.answer.empty() && result.authority.empty() &&
                result.additional.empty(),
            expected + " fabricated response records");
  }
}

void supportedRecordTypesContract() {
  for (const auto& [type, expectedData] :
       std::vector<std::pair<std::string, std::string>>{
           {"A", "192.0.2.44"},
           {"AAAA", "2001:db8::44"},
           {"CNAME", "cname: target.example."},
           {"MX", "preference: 10 · exchange: mail.example."},
           {"TXT", "\"hello\" · \"world\""},
           {"NS", "host: target.example."},
           {"SOA", "mname: ns1.example."},
           {"PTR", "ptrdname: target.example."},
           {"SRV", "priority: 10 · weight: 20 · port: 443"},
           {"CAA", "critical: 0 · tag: issue · value: \"letsencrypt.org\""},
           {"HTTPS", "priority: 1 · target: service.example."},
           {"SVCB", "priority: 1 · target: service.example."}}) {
    ControlledDnsServer server(AF_INET);
    auto service = makeCaresDnsService();
    QueryCompletion completion;
    start(service, "supported-" + type, customQuery(server, type), completion);
    const auto result = successful(completion);
    require(result.answer.size() == 1, type + " answer was not parsed");
    require(result.answer[0].type == type, type + " type was not preserved");
    require(result.answer[0].data.find(expectedData) != std::string::npos,
            type + " structured data was not preserved");
  }
}

void transportContract() {
  auto service = makeCaresDnsService();

  ControlledDnsServer tcpServer(AF_INET);
  QueryCompletion tcpCompletion;
  start(service, "forced-tcp", customQuery(tcpServer, "A", "tcp"),
        tcpCompletion);
  const auto tcpResult = successful(tcpCompletion);
  require(tcpResult.transport == "tcp", "forced TCP was not reported");
  require(tcpServer.observation().tcpCount == 1,
          "forced TCP did not use TCP");
  require(tcpServer.observation().udpCount == 0,
          "forced TCP unexpectedly used UDP");

  ControlledDnsServer fallbackServer(AF_INET,
                                     ServerBehavior::TruncateUdp);
  QueryCompletion fallbackCompletion;
  start(service, "udp-fallback", customQuery(fallbackServer, "A", "auto"),
        fallbackCompletion);
  const auto fallbackResult = successful(fallbackCompletion);
  require(fallbackResult.transport == "tcp",
          "truncated UDP did not report TCP fallback");
  require(fallbackResult.answer.size() == 1,
          "fallback exposed an incomplete UDP response");
  require(fallbackServer.observation().udpCount == 1 &&
              fallbackServer.observation().tcpCount == 1,
          "truncated UDP did not retry once over TCP");
}

void ednsAndDnssecContract() {
  auto service = makeCaresDnsService();
  ControlledDnsServer server(AF_INET, ServerBehavior::Answer, 44, true);
  auto query = customQuery(server);
  query.ednsUdpSize = 1400;
  query.dnssecOk = true;
  QueryCompletion completion;
  start(service, "edns-do", query, completion);
  const auto result = successful(completion);
  const auto observed = server.observation();
  require(observed.hasEdns, "EDNS OPT record was omitted");
  require(observed.ednsUdpSize == 1400, "EDNS UDP size changed");
  require(observed.dnssecOk, "DO bit was omitted");
  require(!observed.checkingDisabled,
          "requesting DNSSEC records incorrectly set CD");
  require(std::find(result.flags.begin(), result.flags.end(), "ad") !=
              result.flags.end(),
          "DNSSEC-related response flags were not observable");

  ControlledDnsServer noEdnsServer(AF_INET);
  auto noEdnsQuery = customQuery(noEdnsServer);
  noEdnsQuery.ednsUdpSize.reset();
  QueryCompletion noEdnsCompletion;
  start(service, "without-edns", noEdnsQuery, noEdnsCompletion);
  successful(noEdnsCompletion);
  require(!noEdnsServer.observation().hasEdns,
          "disabled EDNS still sent an OPT record");
}

void timeoutRetryAndCancellationContract() {
  auto service = makeCaresDnsService();

  ControlledDnsServer retryServer(AF_INET,
                                  ServerBehavior::DropFirstThenAnswer);
  auto retryQuery = customQuery(retryServer);
  retryQuery.timeoutMs = 300;
  retryQuery.retries = 1;
  QueryCompletion retryCompletion;
  start(service, "retry", retryQuery, retryCompletion);
  retryCompletion.wait();
  require(!retryCompletion.failure.has_value(),
          retryCompletion.failure.has_value()
              ? retryCompletion.failure->message + " (requests: " +
                    std::to_string(retryServer.observation().udpCount) + ")"
              : "retry Query failed");
  require(retryServer.observation().udpCount == 2,
          "configured retry count was not honored");

  ControlledDnsServer timeoutServer(AF_INET, ServerBehavior::Ignore);
  auto timeoutQuery = customQuery(timeoutServer);
  timeoutQuery.timeoutMs = 300;
  timeoutQuery.retries = 1;
  QueryCompletion timeoutCompletion;
  start(service, "timeout", timeoutQuery, timeoutCompletion);
  const auto timeout = failed(timeoutCompletion);
  require(timeout.code == FailureCode::Timeout,
          "timeout failure was not classified");
  require(timeoutServer.observation().udpCount == 2,
          "timeout did not make the configured number of attempts");

  ControlledDnsServer immediateServer(AF_INET, ServerBehavior::Ignore);
  QueryCompletion immediateCompletion;
  start(service, "immediate-cancel", customQuery(immediateServer),
        immediateCompletion);
  service->cancel("immediate-cancel");
  require(failed(immediateCompletion).code == FailureCode::Cancelled,
          "cancellation before channel setup was not classified");

  ControlledDnsServer cancelledServer(AF_INET, ServerBehavior::Ignore);
  QueryCompletion cancelledCompletion;
  start(service, "cancelled", customQuery(cancelledServer),
        cancelledCompletion);
  require(cancelledServer.waitForRequests(1),
          "cancelled Query never reached its resolver");
  service->cancel("cancelled");
  const auto cancelled = failed(cancelledCompletion);
  require(cancelled.code == FailureCode::Cancelled,
          "cancellation failure was not classified");
}

void concurrencyAndFreshChannelContract() {
  auto service = makeCaresDnsService();

  ControlledDnsServer delayed(AF_INET, ServerBehavior::DelayedAnswer);
  QueryCompletion delayedCompletion;
  const auto invocationStarted = std::chrono::steady_clock::now();
  start(service, "sequential-delayed", customQuery(delayed),
        delayedCompletion);
  const auto invocationElapsed = std::chrono::steady_clock::now() -
                                 invocationStarted;
  require(invocationElapsed < 50ms,
          "Query setup blocked its calling thread");
  require(successful(delayedCompletion).elapsedMs >= 50,
          "controlled delay did not remain asynchronous");

  ControlledDnsServer blocked(AF_INET, ServerBehavior::Ignore);
  ControlledDnsServer responsive(AF_INET6, ServerBehavior::Answer, 45);
  QueryCompletion blockedCompletion;
  QueryCompletion responsiveCompletion;
  start(service, "concurrent-blocked", customQuery(blocked),
        blockedCompletion);
  start(service, "concurrent-responsive", customQuery(responsive, "AAAA"),
        responsiveCompletion);
  require(blocked.waitForRequests(1), "blocked concurrent Query was not sent");
  service->cancel("concurrent-blocked");
  const auto responsiveResult = successful(responsiveCompletion);
  const auto blockedFailure = failed(blockedCompletion);
  require(responsiveResult.answer[0].data == "2001:db8::45",
          "one Query completed into another Query's caller");
  require(blockedFailure.code == FailureCode::Cancelled,
          "concurrent cancellation affected the wrong Query");

  ControlledDnsServer firstNetwork(AF_INET, ServerBehavior::Answer, 46);
  QueryCompletion firstCompletion;
  start(service, "network-before", customQuery(firstNetwork), firstCompletion);
  require(successful(firstCompletion).answer[0].data == "192.0.2.46",
          "first resolver state was not used");

  ControlledDnsServer currentNetwork(AF_INET, ServerBehavior::Answer, 47);
  QueryCompletion currentCompletion;
  start(service, "network-after", customQuery(currentNetwork),
        currentCompletion);
  const auto currentResult = successful(currentCompletion);
  require(currentResult.answer[0].data == "192.0.2.47",
          "subsequent Query reused stale resolver state");
  require(currentResult.server->port == currentNetwork.port(),
          "subsequent Query reported a stale resolver endpoint");
}

void failureClassificationContract() {
  auto service = makeCaresDnsService();

  Query invalid;
  invalid.name = "controlled.test";
  invalid.type = "BOGUS";
  invalid.transport = "udp";
  QueryCompletion invalidCompletion;
  start(service, "invalid-input", invalid, invalidCompletion);
  require(failed(invalidCompletion).code == FailureCode::InvalidInput,
          "invalid input failure was not classified");

  ControlledDnsServer malformedServer(AF_INET, ServerBehavior::Malformed);
  QueryCompletion malformedCompletion;
  start(service, "malformed-response", customQuery(malformedServer),
        malformedCompletion);
  require(failed(malformedCompletion).code == FailureCode::InvalidResponse,
          "malformed response failure was not classified");

  int reserved = socket(AF_INET, SOCK_STREAM, 0);
  require(reserved >= 0, "network classification socket failed");
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  require(bind(reserved, reinterpret_cast<sockaddr*>(&address),
               sizeof(address)) == 0,
          "network classification bind failed");
  socklen_t addressLength = sizeof(address);
  getsockname(reserved, reinterpret_cast<sockaddr*>(&address), &addressLength);
  const auto unusedPort = ntohs(address.sin_port);
  close(reserved);

  Query unavailable;
  unavailable.name = "controlled.test";
  unavailable.type = "A";
  unavailable.resolver.mode = Resolver::Mode::Custom;
  unavailable.resolver.address = "127.0.0.1";
  unavailable.resolver.port = unusedPort;
  unavailable.transport = "tcp";
  unavailable.timeoutMs = 250;
  unavailable.retries = 0;
  QueryCompletion unavailableCompletion;
  start(service, "network-unavailable", unavailable, unavailableCompletion);
  require(failed(unavailableCompletion).code == FailureCode::NetworkUnavailable,
          "unavailable network failure was not classified");
}

}  // namespace

std::string runContractScenarios() {
  try {
    const auto scenario = [](const std::string& name, const auto& run) {
      try {
        run();
      } catch (const std::exception& error) {
        throw std::runtime_error(name + ": " + error.what());
      }
    };
    scenario("IPv4 A", [] {
      customResolverContract(AF_INET, "A", "192.0.2.44");
    });
    scenario("IPv4 AAAA", [] {
      customResolverContract(AF_INET, "AAAA", "2001:db8::44");
    });
    scenario("IPv6 A", [] {
      customResolverContract(AF_INET6, "A", "192.0.2.44");
    });
    scenario("IPv6 AAAA", [] {
      customResolverContract(AF_INET6, "AAAA", "2001:db8::44");
    });
    scenario("complete Result", completeResultContract);
    scenario("response codes", responseCodesContract);
    scenario("supported record types", supportedRecordTypesContract);
    scenario("transport", transportContract);
    scenario("EDNS and DNSSEC", ednsAndDnssecContract);
    scenario("timeout, retry, and cancellation",
             timeoutRetryAndCancellationContract);
    scenario("concurrency and fresh channels",
             concurrencyAndFreshChannelContract);
    scenario("failure classification", failureClassificationContract);
    return {};
  } catch (const std::exception& error) {
    return error.what();
  }
}

}  // namespace digger::dns::testing
