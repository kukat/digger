#pragma once

#include <string>

namespace digger::dns::testing {

// Returns an empty string when every deterministic native contract scenario
// passes, otherwise the first failure message.
std::string runContractScenarios();

}  // namespace digger::dns::testing
