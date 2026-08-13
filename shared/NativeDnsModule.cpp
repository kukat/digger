#include "NativeDnsModule.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <utility>

namespace facebook::react {
namespace {

unsigned short portValue(double value) {
  if (!std::isfinite(value) || value < 1 || value > 65535 ||
      std::floor(value) != value) {
    throw std::invalid_argument("Custom resolver port must be between 1 and 65535.");
  }
  return static_cast<unsigned short>(value);
}

digger::dns::Query toServiceQuery(const DnsQueryValue& value) {
  digger::dns::Query query;
  query.name = value.name;
  query.type = value.type;
  if (value.resolver.mode != "system" && value.resolver.mode != "custom") {
    throw std::invalid_argument("Resolver mode is invalid.");
  }
  query.resolver.mode = value.resolver.mode == "custom"
      ? digger::dns::Resolver::Mode::Custom
      : digger::dns::Resolver::Mode::System;
  query.resolver.address = value.resolver.address;
  if (value.resolver.port.has_value()) {
    query.resolver.port = portValue(*value.resolver.port);
  }
  query.transport = value.transport;
  if (!std::isfinite(value.timeoutMs) || value.timeoutMs < 1 ||
      value.timeoutMs > 120000 || std::floor(value.timeoutMs) != value.timeoutMs ||
      !std::isfinite(value.retries) || value.retries < 0 || value.retries > 10 ||
      std::floor(value.retries) != value.retries) {
    throw std::invalid_argument("Timeout and retry values must be valid.");
  }
  query.timeoutMs = static_cast<int>(value.timeoutMs);
  query.retries = static_cast<int>(value.retries);
  query.dnssecOk = value.dnssecOk;
  if (value.ednsUdpSize.has_value()) {
    const auto size = *value.ednsUdpSize;
    if (!std::isfinite(size) || size < 512 || size > 65535 ||
        std::floor(size) != size) {
      throw std::invalid_argument(
          "EDNS UDP size must be between 512 and 65535 bytes.");
    }
    query.ednsUdpSize = static_cast<unsigned short>(size);
  }
  return query;
}

DnsQuestionValue toValue(const digger::dns::Question& question) {
  return {question.name, question.type, question.recordClass};
}

DnsRecordValue toValue(const digger::dns::Record& record) {
  return {record.name, record.type, record.ttl, record.data};
}

DnsResultValue toValue(digger::dns::Result result) {
  std::vector<DnsQuestionValue> questions;
  questions.reserve(result.question.size());
  std::transform(result.question.begin(), result.question.end(),
                 std::back_inserter(questions),
                 [](const auto& question) { return toValue(question); });

  const auto mapRecords = [](const std::vector<digger::dns::Record>& records) {
    std::vector<DnsRecordValue> values;
    values.reserve(records.size());
    std::transform(records.begin(), records.end(), std::back_inserter(values),
                   [](const auto& record) { return toValue(record); });
    return values;
  };

  std::optional<DnsServerEndpointValue> server;
  if (result.server.has_value()) {
    server = DnsServerEndpointValue{result.server->address,
                                    result.server->port};
  }

  return {std::move(result.rcode),
          std::move(result.flags),
          std::move(questions),
          mapRecords(result.answer),
          mapRecords(result.authority),
          mapRecords(result.additional),
          std::move(server),
          std::move(result.transport),
          result.elapsedMs,
          result.wireBytes};
}

}  // namespace

NativeDnsModule::NativeDnsModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeDnsModuleCxxSpec(std::move(jsInvoker)),
      service_(digger::dns::makeCaresDnsService()) {}

AsyncPromise<DnsResultValue> NativeDnsModule::query(jsi::Runtime& runtime,
                                                     std::string queryId,
                                                     DnsQueryValue request) {
  AsyncPromise<DnsResultValue> promise(runtime, jsInvoker_);
  try {
    service_->query(
        std::move(queryId), toServiceQuery(request),
        [promise](digger::dns::Result result) mutable {
          promise.resolve(toValue(std::move(result)));
        },
        [promise](std::string error) mutable { promise.reject(std::move(error)); });
  } catch (const std::exception& error) {
    promise.reject(error.what());
  }
  return promise;
}

void NativeDnsModule::cancel(jsi::Runtime&, std::string queryId) {
  service_->cancel(queryId);
}

}  // namespace facebook::react
