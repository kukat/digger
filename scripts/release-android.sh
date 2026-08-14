#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
: "${DIGGER_ANDROID_KEYSTORE:?Set DIGGER_ANDROID_KEYSTORE to the release keystore path.}"
: "${DIGGER_ANDROID_KEYSTORE_PASSWORD:?Set DIGGER_ANDROID_KEYSTORE_PASSWORD.}"
: "${DIGGER_ANDROID_KEY_ALIAS:?Set DIGGER_ANDROID_KEY_ALIAS.}"
: "${DIGGER_ANDROID_KEY_PASSWORD:?Set DIGGER_ANDROID_KEY_PASSWORD.}"
[[ -f "$DIGGER_ANDROID_KEYSTORE" ]] || {
  echo "DIGGER_ANDROID_KEYSTORE does not name a readable file." >&2
  exit 1
}

"$root/scripts/verify-release-readiness.sh"
(
  cd "$root/android"
  ./gradlew :app:bundleRelease
)

bundle="$root/android/app/build/outputs/bundle/release/app-release.aab"
[[ -f "$bundle" ]] || {
  echo "Android release bundle was not created at $bundle." >&2
  exit 1
}
for abi in armeabi-v7a arm64-v8a x86 x86_64; do
  unzip -Z1 "$bundle" | grep "^base/lib/$abi/libappmodules.so$" >/dev/null || {
    echo "Release bundle is missing native libraries for $abi." >&2
    exit 1
  }
done

echo "Signed Android App Bundle: $bundle"
