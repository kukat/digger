#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$root/ios/Pods/c-ares"

if [[ ! -d "$source_dir" ]]; then
  echo "c-ares sources are missing; run 'cd ios && bundle exec pod install' first." >&2
  exit 1
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/digger-native-tests.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

prefix="$(brew --prefix c-ares 2>/dev/null || true)"
if [[ -z "$prefix" || ! -f "$prefix/lib/libcares.a" ]]; then
  echo "Native contract tests require Homebrew c-ares (brew install c-ares)." >&2
  exit 1
fi
# The test host library is only the test runner. iOS device and simulator
# builds compile the pinned 1.34.5 sources from c-ares.podspec.

mkdir -p "$work_dir/include/cares"
for header in "$prefix"/include/*.h; do
  ln -s "$header" "$work_dir/include/cares/$(basename "$header")"
done
cares_library="$prefix/lib/libcares.a"

"${CXX:-clang++}" -std=c++20 -pthread \
  -I"$root/shared" \
  -I"$work_dir/include" \
  "$root/shared/CaresDnsService.cpp" \
  "$root/shared/tests/DnsServiceContractTests.cpp" \
  "$cares_library" \
  -o "$work_dir/dns-service-contract-tests"

"$work_dir/dns-service-contract-tests"
