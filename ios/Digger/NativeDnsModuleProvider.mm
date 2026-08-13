#import "NativeDnsModuleProvider.h"

#import <ReactCommon/CallInvoker.h>
#import <ReactCommon/TurboModule.h>

#import "NativeDnsModule.h"

@implementation NativeDnsModuleProvider

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeDnsModule>(params.jsInvoker);
}

@end
