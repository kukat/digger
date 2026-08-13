#pragma once

#if __has_include(<ReactCodegen/DiggerSpecsJSI.h>)
#include <ReactCodegen/DiggerSpecsJSI.h>
#else
#include "DiggerSpecsJSI.h"
#endif

#include "DnsService.h"

#include <memory>
#include <optional>
#include <string>
#include <vector>

namespace facebook::react {

using DnsResolverValue = NativeDnsModuleDnsResolverSpec<
    std::string, std::optional<std::string>, std::optional<double>>;
template <>
struct Bridging<DnsResolverValue>
    : NativeDnsModuleDnsResolverSpecBridging<DnsResolverValue> {};

using DnsQueryValue = NativeDnsModuleDnsQuerySpec<
    std::string, std::string, DnsResolverValue, std::string, double, double,
    bool, std::optional<double>>;
template <>
struct Bridging<DnsQueryValue>
    : NativeDnsModuleDnsQuerySpecBridging<DnsQueryValue> {};

using DnsQuestionValue =
    NativeDnsModuleDnsQuestion<std::string, std::string, std::string>;
template <>
struct Bridging<DnsQuestionValue>
    : NativeDnsModuleDnsQuestionBridging<DnsQuestionValue> {};

using DnsRecordValue =
    NativeDnsModuleDnsRecord<std::string, std::string, double, std::string>;
template <>
struct Bridging<DnsRecordValue>
    : NativeDnsModuleDnsRecordBridging<DnsRecordValue> {};

using DnsServerEndpointValue =
    NativeDnsModuleDnsServerEndpoint<std::string, double>;
template <>
struct Bridging<DnsServerEndpointValue>
    : NativeDnsModuleDnsServerEndpointBridging<DnsServerEndpointValue> {};

using DnsResultValue = NativeDnsModuleDnsResult<
    std::string, std::vector<std::string>, std::vector<DnsQuestionValue>,
    std::vector<DnsRecordValue>, std::vector<DnsRecordValue>,
    std::vector<DnsRecordValue>, std::optional<DnsServerEndpointValue>,
    std::string, double, double>;
template <>
struct Bridging<DnsResultValue>
    : NativeDnsModuleDnsResultBridging<DnsResultValue> {};

class NativeDnsModule final
    : public NativeDnsModuleCxxSpec<NativeDnsModule> {
 public:
  explicit NativeDnsModule(std::shared_ptr<CallInvoker> jsInvoker);

  AsyncPromise<DnsResultValue> query(jsi::Runtime& runtime,
                                     std::string queryId,
                                     DnsQueryValue request);
  void cancel(jsi::Runtime& runtime, std::string queryId);

 private:
  std::shared_ptr<digger::dns::DnsService> service_;
};

}  // namespace facebook::react
