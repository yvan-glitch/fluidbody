Pod::Spec.new do |s|
  s.name           = 'FluidbodyWatch'
  s.version        = '1.0.0'
  s.summary        = 'Pont iPhone <-> Apple Watch (WatchConnectivity + HealthKit) pour FLUIDBODY+'
  s.description    = 'Module Expo local : lance la séance sur la montre, relaie FC/kcal en direct.'
  s.author         = 'Espace Pilates Sàrl'
  s.homepage       = 'https://fluidbody.ch'
  s.license        = { :type => 'Proprietary' }
  # tvOS : le code est compilé en no-op (#if os(iOS)), pour que le build
  # Apple TV n'échoue pas si l'autolinking inclut le module.
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.ios.frameworks = 'WatchConnectivity', 'HealthKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
