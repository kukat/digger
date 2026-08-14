#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
: "${DIGGER_IOS_TEAM_ID:?Set DIGGER_IOS_TEAM_ID to the Apple Developer team ID.}"

"$root/scripts/verify-release-readiness.sh"
archive_path="$root/build/release/Digger.xcarchive"
export_path="$root/build/release/ipa"
rm -rf "$archive_path" "$export_path"

xcodebuild \
  -workspace "$root/ios/Digger.xcworkspace" \
  -scheme Digger \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$archive_path" \
  DEVELOPMENT_TEAM="$DIGGER_IOS_TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  archive

app="$archive_path/Products/Applications/Digger.app"
[[ -f "$app/Digger" ]] || {
  echo "iOS archive does not contain Digger.app." >&2
  exit 1
}
lipo -archs "$app/Digger" | grep -w arm64 >/dev/null || {
  echo "iOS archive is missing the arm64 device architecture." >&2
  exit 1
}
plutil -extract NSLocalNetworkUsageDescription raw "$app/Info.plist" >/dev/null

xcodebuild \
  -exportArchive \
  -archivePath "$archive_path" \
  -exportOptionsPlist "$root/ios/ExportOptions.plist" \
  -exportPath "$export_path" \
  -allowProvisioningUpdates

ipa="$export_path/Digger.ipa"
[[ -f "$ipa" ]] || {
  echo "iOS archive export did not create $ipa." >&2
  exit 1
}

echo "Signed iOS IPA: $ipa"
