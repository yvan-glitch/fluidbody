//  WatchSessionBridge.m  (cible iPhone)
//  Expose la classe Swift WatchSessionBridge à React Native.
//
//  ⚠️ Échafaudage non compilé.

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(WatchSession, RCTEventEmitter)

RCT_EXTERN_METHOD(startWatchWorkout:(NSDictionary *)info
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopWatchWorkout)

@end
