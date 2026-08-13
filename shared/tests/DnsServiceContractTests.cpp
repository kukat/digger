#include "DnsServiceContractScenarios.h"

#include <iostream>

int main() {
  const auto failure = digger::dns::testing::runContractScenarios();
  if (!failure.empty()) {
    std::cerr << failure << '\n';
    return 1;
  }
  std::cout << "DNS service contract tests passed\n";
  return 0;
}
