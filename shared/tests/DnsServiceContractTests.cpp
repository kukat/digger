#include "DnsService.h"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <array>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {

class ControlledDnsServer {
 public:
  explicit ControlledDnsServer(int family) : family_(family) {
    socket_ = socket(family, SOCK_DGRAM, 0);
    if (socket_ < 0) {
      throw std::runtime_error("socket failed");
    }
    if (family == AF_INET) {
      sockaddr_in address{};
      address.sin_family = AF_INET;
      address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
      if (bind(socket_, reinterpret_cast<sockaddr*>(&address), sizeof(address)) !=
          0) {
        throw std::runtime_error("IPv4 bind failed");
      }
      socklen_t length = sizeof(address);
      getsockname(socket_, reinterpret_cast<sockaddr*>(&address), &length);
      port_ = ntohs(address.sin_port);
      address_ = "127.0.0.1";
    } else {
      sockaddr_in6 address{};
      address.sin6_family = AF_INET6;
      address.sin6_addr = in6addr_loopback;
      if (bind(socket_, reinterpret_cast<sockaddr*>(&address), sizeof(address)) !=
          0) {
        throw std::runtime_error("IPv6 bind failed");
      }
      socklen_t length = sizeof(address);
      getsockname(socket_, reinterpret_cast<sockaddr*>(&address), &length);
      port_ = ntohs(address.sin6_port);
      address_ = "::1";
    }
    worker_ = std::thread([this] { serve(); });
  }

  ~ControlledDnsServer() {
    close(socket_);
    if (worker_.joinable()) {
      worker_.join();
    }
  }

  const std::string& address() const { return address_; }
  unsigned short port() const { return port_; }

 private:
  static size_t questionEnd(const uint8_t* packet, size_t size) {
    size_t index = 12;
    while (index < size && packet[index] != 0) {
      index += static_cast<size_t>(packet[index]) + 1;
    }
    return index + 5;
  }

  void serve() {
    std::array<uint8_t, 512> request{};
    sockaddr_storage peer{};
    socklen_t peerLength = sizeof(peer);
    const auto length = recvfrom(socket_, request.data(), request.size(), 0,
                                 reinterpret_cast<sockaddr*>(&peer), &peerLength);
    if (length <= 0) {
      return;
    }
    const auto end = questionEnd(request.data(), static_cast<size_t>(length));
    const auto type = static_cast<uint16_t>((request[end - 4] << 8) |
                                            request[end - 3]);
    std::vector<uint8_t> response(request.begin(), request.begin() + end);
    response[2] = 0x81;
    response[3] = 0x80;
    response[4] = 0;
    response[5] = 1;
    response[6] = 0;
    response[7] = 1;
    response[8] = 0;
    response[9] = 0;
    response[10] = 0;
    response[11] = 0;
    response.insert(response.end(), {0xc0, 0x0c,
                                     static_cast<uint8_t>(type >> 8),
                                     static_cast<uint8_t>(type), 0, 1,
                                     0, 0, 0, 60});
    if (type == 1) {
      response.insert(response.end(), {0, 4, 192, 0, 2, 44});
    } else {
      const std::array<uint8_t, 16> ipv6 = {
          0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0,
          0,    0,    0,    0,    0, 0, 0, 0x44};
      response.insert(response.end(), {0, 16});
      response.insert(response.end(), ipv6.begin(), ipv6.end());
    }
    sendto(socket_, response.data(), response.size(), 0,
           reinterpret_cast<sockaddr*>(&peer), peerLength);
  }

  int family_;
  int socket_{};
  unsigned short port_{};
  std::string address_;
  std::thread worker_;
};

void require(bool condition, const char* message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

void customResolverContract(int family, const std::string& type,
                            const std::string& expected) {
  ControlledDnsServer server(family);
  auto service = digger::dns::makeCaresDnsService();
  digger::dns::Query query;
  query.name = "controlled.test";
  query.type = type;
  query.resolver.mode = digger::dns::Resolver::Mode::Custom;
  query.resolver.address = server.address();
  query.resolver.port = server.port();
  query.transport = "udp";
  query.timeoutMs = 1000;
  query.retries = 0;
  query.ednsUdpSize = 1232;

  std::mutex mutex;
  std::condition_variable condition;
  bool completed = false;
  std::string failure;
  digger::dns::Result result;
  service->query(
      "contract-" + type, query,
      [&](digger::dns::Result value) {
        std::lock_guard lock(mutex);
        result = std::move(value);
        completed = true;
        condition.notify_one();
      },
      [&](std::string message) {
        std::lock_guard lock(mutex);
        failure = std::move(message);
        completed = true;
        condition.notify_one();
      });

  std::unique_lock lock(mutex);
  require(condition.wait_for(lock, std::chrono::seconds(3),
                             [&] { return completed; }),
          "controlled Query did not complete");
  require(failure.empty(), failure.c_str());
  require(result.rcode == "NOERROR", "unexpected response code");
  require(result.answer.size() == 1, "answer section was not parsed");
  require(result.answer[0].type == type, "record type was not preserved");
  require(result.answer[0].data == expected, "record address was not parsed");
  require(result.question.size() == 1, "question section was not parsed");
  require(result.server.has_value(), "custom server endpoint was omitted");
  require(result.server->address == server.address(),
          "custom server address changed");
  require(result.server->port == server.port(), "custom server port changed");
  require(result.transport == "udp", "transport was not reported");
  require(result.elapsedMs >= 0, "elapsed time was not reported");
  require(result.wireBytes > 0, "wire size was not reported");
}

}  // namespace

int main() {
  try {
    customResolverContract(AF_INET, "A", "192.0.2.44");
    customResolverContract(AF_INET6, "AAAA", "2001:db8::44");
    std::cout << "DNS service contract tests passed\n";
    return 0;
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
