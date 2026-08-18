#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() {
  echo "release-readiness: $*" >&2
  exit 1
}

require_text() {
  local needle="$1"
  local path="$2"
  rg -Fq "$needle" "$path" || fail "expected '$needle' in $path"
}

plutil -lint ios/Digger/Info.plist ios/Digger/PrivacyInfo.xcprivacy >/dev/null

# The application needs only connectivity access; new permissions require an
# explicit review rather than silently becoming part of a release.
expected_permissions=$'android.permission.ACCESS_NETWORK_STATE\nandroid.permission.INTERNET'
actual_permissions="$(grep '<uses-permission ' android/app/src/main/AndroidManifest.xml | grep -o 'android:name="[^"]*"' | cut -d'"' -f2 | sort -u)"
[[ "$actual_permissions" == "$expected_permissions" ]] ||
  fail "Android manifest permissions changed; expected only INTERNET and ACCESS_NETWORK_STATE"

require_text 'NSLocalNetworkUsageDescription' ios/Digger/Info.plist
require_text 'NSAllowsLocalNetworking' ios/Digger/Info.plist
require_text 'NSPrivacyCollectedDataTypes' ios/Digger/PrivacyInfo.xcprivacy
require_text '<array/>' ios/Digger/PrivacyInfo.xcprivacy
require_text 'c-ares (1.34.5)' ios/Podfile.lock
require_text 'c-ares-1.34.5.tar.gz' android/app/src/main/jni/CMakeLists.txt
require_text 'abiFilters "arm64-v8a", "x86_64"' android/app/build.gradle
require_text 'verifyReleaseSigning' android/app/build.gradle
require_text 'Open-source licenses & notices' src/screens/SettingsScreen.tsx
require_text 'c-ares — MIT License' src/screens/SettingsScreen.tsx
require_text 'const storageKey = ' src/history/RecentQueries.ts

package_version="$(node -p "require('./package.json').version")"
android_version="$(grep -E '^[[:space:]]*versionName ' android/app/build.gradle | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
ios_version="$(grep -E '^[[:space:]]*MARKETING_VERSION = ' ios/Digger.xcodeproj/project.pbxproj | head -1 | sed -E 's/.*= ([^;]+);/\1/')"
[[ "$package_version" == "$android_version" && "$package_version" == "$ios_version" ]] ||
  fail "package, Android, and iOS marketing versions must match"

# Production code intentionally has no logging or upload client at the Query /
# Result boundary. Dependency and generated-source directories are excluded.
if rg -n --glob '*.{ts,tsx,cpp,h,kt,mm,swift}' \
  '(console\.|Log\.|NSLog|RCTLog|printf|fprintf|analytics|fetch\(|XMLHttpRequest)' \
  src shared android/app/src ios/Digger; then
  fail "production source contains a possible Query/Result logging or upload path"
fi

echo "Release configuration checks passed. Device acceptance remains a manual release gate."
