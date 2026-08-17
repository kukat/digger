#include <DefaultComponentsRegistry.h>
#include <DefaultTurboModuleManagerDelegate.h>
#include <FBReactNativeSpec.h>
#include <autolinking.h>
#include <ares.h>
#include <fbjni/fbjni.h>
#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>

#include "NativeDnsModule.h"

#ifdef DIGGER_NATIVE_CONTRACT_TESTS
#include "tests/DnsServiceContractScenarios.h"
#endif

#ifdef REACT_NATIVE_APP_CODEGEN_HEADER
#include REACT_NATIVE_APP_CODEGEN_HEADER
#endif
#ifdef REACT_NATIVE_APP_COMPONENT_DESCRIPTORS_HEADER
#include REACT_NATIVE_APP_COMPONENT_DESCRIPTORS_HEADER
#endif

namespace facebook::react {

void registerComponents(
    std::shared_ptr<const ComponentDescriptorProviderRegistry> registry) {
#ifdef REACT_NATIVE_APP_COMPONENT_REGISTRATION
  REACT_NATIVE_APP_COMPONENT_REGISTRATION(registry);
#endif
  autolinking_registerProviders(registry);
}

std::shared_ptr<TurboModule> cxxModuleProvider(
    const std::string& name,
    const std::shared_ptr<CallInvoker>& jsInvoker) {
  if (name == NativeDnsModule::kModuleName) {
    return std::make_shared<NativeDnsModule>(jsInvoker);
  }
  return autolinking_cxxModuleProvider(name, jsInvoker);
}

std::shared_ptr<TurboModule> javaModuleProvider(
    const std::string& name,
    const JavaTurboModule::InitParams& params) {
#ifdef REACT_NATIVE_APP_MODULE_PROVIDER
  if (auto module = REACT_NATIVE_APP_MODULE_PROVIDER(name, params)) {
    return module;
  }
#endif
  if (auto module = FBReactNativeSpec_ModuleProvider(name, params)) {
    return module;
  }
  return autolinking_ModuleProvider(name, params);
}

}  // namespace facebook::react

extern "C" JNIEXPORT jint JNICALL
Java_me_cyao_digger_NativeDnsAndroid_initialize(JNIEnv*, jclass,
                                             jobject connectivityManager) {
  const auto status = ares_library_init(ARES_LIB_INIT_ALL);
  if (status != ARES_SUCCESS) {
    return status;
  }
  const auto androidStatus = ares_library_init_android(connectivityManager);
  if (androidStatus != ARES_SUCCESS) {
    ares_library_cleanup();
  }
  return androidStatus;
}

extern "C" JNIEXPORT jint JNICALL
Java_me_cyao_digger_NativeDnsAndroid_isInitialized(JNIEnv*, jclass) {
  return ares_library_android_initialized();
}

#ifdef DIGGER_NATIVE_CONTRACT_TESTS
extern "C" JNIEXPORT jstring JNICALL
Java_me_cyao_digger_NativeDnsContractTestBridge_run(JNIEnv* environment, jclass) {
  const auto failure = digger::dns::testing::runContractScenarios();
  return failure.empty() ? nullptr
                         : environment->NewStringUTF(failure.c_str());
}
#endif

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  ares_library_init_jvm(vm);
  return facebook::jni::initialize(vm, [] {
    facebook::react::DefaultTurboModuleManagerDelegate::cxxModuleProvider =
        &facebook::react::cxxModuleProvider;
    facebook::react::DefaultTurboModuleManagerDelegate::javaModuleProvider =
        &facebook::react::javaModuleProvider;
    facebook::react::DefaultComponentsRegistry::
        registerComponentDescriptorsFromEntryPoint =
            &facebook::react::registerComponents;
  });
}
