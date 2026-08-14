#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

namespace digger::dns {

struct Resolver {
  enum class Mode { System, Custom };
  Mode mode{Mode::System};
  std::optional<std::string> address;
  std::optional<unsigned short> port;
};

struct Query {
  std::string name;
  std::string type;
  Resolver resolver;
  std::string transport;
  int timeoutMs{3000};
  int retries{1};
  bool dnssecOk{false};
  std::optional<unsigned short> ednsUdpSize;
};

struct Question {
  std::string name;
  std::string type;
  std::string recordClass;
};

struct Record {
  std::string name;
  std::string type;
  double ttl{0};
  std::string data;
};

struct Endpoint {
  std::string address;
  double port{53};
};

struct Result {
  std::string rcode;
  std::vector<std::string> flags;
  std::vector<Question> question;
  std::vector<Record> answer;
  std::vector<Record> authority;
  std::vector<Record> additional;
  std::optional<Endpoint> server;
  std::string transport;
  double elapsedMs{0};
  double wireBytes{0};
};

enum class FailureCode {
  InvalidInput,
  Timeout,
  Cancelled,
  NetworkUnavailable,
  InvalidResponse,
  InternalNative,
};

struct Failure {
  FailureCode code{FailureCode::InternalNative};
  std::string message;
};

class DnsService {
 public:
  using Success = std::function<void(Result)>;
  using FailureCallback = std::function<void(Failure)>;

  virtual ~DnsService() = default;
  virtual void query(std::string queryId, Query query, Success success,
                     FailureCallback failure) = 0;
  virtual void cancel(const std::string& queryId) = 0;
};

std::shared_ptr<DnsService> makeCaresDnsService();

}  // namespace digger::dns
