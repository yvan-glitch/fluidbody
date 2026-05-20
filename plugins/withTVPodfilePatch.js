// withTVPodfilePatch — Expo config plugin
//
// Injects tvOS-specific patches into ios/Podfile during `expo prebuild`.
// Without this plugin, the patches get wiped every time prebuild regenerates
// the Podfile from its template.
//
// What the plugin does:
//   1. Forces C++20 standard on all pod targets (required by fmt 11, Folly).
//   2. Disables -Werror so the build doesn't fail on benign deprecation
//      warnings in libavif / RNCAsyncStorage.
//   3. Sets TVOS_DEPLOYMENT_TARGET = 15.1 on all targets.
//   4. Adds FMT_USE_CONSTEVAL=0 preprocessor define to fmt / Folly / glog.
//   5. Patches `Pods/fmt/include/fmt/base.h` directly to force
//      FMT_USE_CONSTEVAL=0 (the macro define alone isn't enough because
//      fmt's internal detection chain re-defines it for Apple Clang 14+).
//
// Why all this is needed: react-native-tvos 0.81.5 + fmt 11 + Apple Clang
// (Xcode 26) → fmt's `consteval` functions trigger "Call to consteval
// function in a constant expression" errors. Downgrading to constexpr is
// safe — we lose compile-time format-string validation but it's optional.
//
// Activation: only applies when EXPO_TV=1 (i.e. the tvOS build path).

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const POST_INSTALL_PATCH = `
    # ===========================================================
    # FLUIDBODY_TV_PATCH — tvOS post_install patches injected by
    # plugins/withTVPodfilePatch.js. Do not edit by hand; re-run
    # \`expo prebuild --clean\` if you need to refresh.
    # ===========================================================
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
        config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        config.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
        config.build_settings['TVOS_DEPLOYMENT_TARGET'] = '15.1'
      end

      if target.name == 'fmt' || target.name == 'RCT-Folly' || target.name == 'glog'
        target.build_configurations.each do |config|
          existing = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
          existing = [existing] if existing.is_a?(String)
          existing << 'FMT_CONSTEVAL=constexpr'
          existing << 'FMT_USE_CONSTEVAL=0'
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = existing
        end
      end
    end

    # Patch direct du header fmt/base.h pour neutraliser la détection
    # interne de consteval. Sans ça, fmt 11 force FMT_USE_CONSTEVAL=1 sur
    # Apple Clang 14+ et les macro defines externes sont écrasés.
    fmt_base_h = File.join(installer.sandbox.root, 'fmt/include/fmt/base.h')
    if File.exist?(fmt_base_h)
      content = File.read(fmt_base_h)
      patch_marker = '// FLUIDBODY_TV_PATCH: force FMT_USE_CONSTEVAL=0 (tvOS compat)'
      unless content.include?(patch_marker)
        # rend writable (CocoaPods extrait en read-only depuis son cache)
        File.chmod(0644, fmt_base_h) rescue nil
        new_content = content.sub(
          /\\/\\/ Detect consteval.*?#endif\\n#if FMT_USE_CONSTEVAL/m,
          "#{patch_marker}\\n#define FMT_USE_CONSTEVAL 0\\n#if FMT_USE_CONSTEVAL"
        )
        if new_content != content
          File.write(fmt_base_h, new_content)
          puts "[FluidBody TV] Patched #{fmt_base_h} (force FMT_USE_CONSTEVAL=0)"
        end
      end
    end
    # ===========================================================
    # End tvOS post_install patches
    # ===========================================================
`;

function patchPodfile(contents) {
  // Find the existing post_install block from react_native_post_install
  // and inject our patches right after it.
  const marker = ':ccache_enabled => ccache_enabled?(podfile_properties),';
  const closingPattern = /,\n(\s*)\)\n(\s*)end\nend\s*$/;

  if (contents.includes('FLUIDBODY_TV_PATCH')) {
    return contents; // already patched
  }

  // Insert before the closing `)\n  end\nend` of the post_install block.
  const idx = contents.indexOf(marker);
  if (idx === -1) {
    throw new Error('withTVPodfilePatch: could not find react_native_post_install marker in Podfile');
  }
  // Find the closing ) of react_native_post_install
  const closingRelative = contents.slice(idx).search(/\n\s*\)/);
  if (closingRelative === -1) {
    throw new Error('withTVPodfilePatch: could not find closing ) of react_native_post_install');
  }
  const insertAt = idx + closingRelative;
  // Skip past the ) to insert after it
  const afterClose = contents.indexOf('\n', insertAt + 1) + 1;
  return contents.slice(0, afterClose) + POST_INSTALL_PATCH + contents.slice(afterClose);
}

// Patches the "Upload Debug Symbols to Sentry" build phase in
// FluidBody.xcodeproj/project.pbxproj to prepend SENTRY_DISABLE_AUTO_UPLOAD=true
// to its shellScript. Without this, Sentry's CLI fails the build because
// the local env has no SENTRY_ORG / SENTRY_PROJECT config.
function patchProjectPbxproj(contents) {
  const marker = 'SENTRY_DISABLE_AUTO_UPLOAD=true';
  if (contents.includes(marker)) return contents; // already patched
  // The shellScript for the "Upload Debug Symbols to Sentry" phase starts with
  //   "/bin/sh `${NODE_BINARY:-node} --print "require('path').dirname(require.resolve('@sentry/react-native/...
  // We prepend the env export.
  const target = 'shellScript = "/bin/sh `${NODE_BINARY:-node} --print \\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode-debug-files.sh\'\\"`";';
  const replacement = 'shellScript = "export SENTRY_DISABLE_AUTO_UPLOAD=true\\n/bin/sh `${NODE_BINARY:-node} --print \\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode-debug-files.sh\'\\"`";';
  if (!contents.includes(target)) return contents; // shellScript pattern not found; skip silently
  return contents.replace(target, replacement);
}

module.exports = function withTVPodfilePatch(config) {
  // Mod 1: patch Podfile (post_install hooks for fmt + C++20 + Werror)
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }
      const contents = fs.readFileSync(podfilePath, 'utf8');
      const patched = patchPodfile(contents);
      if (patched !== contents) {
        fs.writeFileSync(podfilePath, patched);
        console.log('[withTVPodfilePatch] Injected tvOS post_install patches into Podfile');
      }
      return cfg;
    },
  ]);

  // Mod 2: patch project.pbxproj to disable Sentry sourcemap upload in the
  // "Upload Debug Symbols to Sentry" build phase. Companion to the
  // SENTRY_DISABLE_AUTO_UPLOAD=true line in ios/.xcode.env.local (which
  // handles the OTHER Sentry phase via .xcode.env sourcing).
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projPath = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName ? `${cfg.modRequest.projectName}.xcodeproj` : 'FluidBody.xcodeproj',
        'project.pbxproj'
      );
      if (!fs.existsSync(projPath)) return cfg;
      const contents = fs.readFileSync(projPath, 'utf8');
      const patched = patchProjectPbxproj(contents);
      if (patched !== contents) {
        fs.writeFileSync(projPath, patched);
        console.log('[withTVPodfilePatch] Disabled Sentry sourcemap upload in project.pbxproj');
      }
      return cfg;
    },
  ]);

  // Mod 3: ensure ios/.xcode.env.local has SENTRY_DISABLE_AUTO_UPLOAD=true
  // for the "Bundle React Native code and images" Sentry phase.
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const envLocalPath = path.join(cfg.modRequest.platformProjectRoot, '.xcode.env.local');
      let contents = '';
      if (fs.existsSync(envLocalPath)) {
        contents = fs.readFileSync(envLocalPath, 'utf8');
      }
      if (contents.includes('SENTRY_DISABLE_AUTO_UPLOAD')) {
        return cfg;
      }
      const line = 'export SENTRY_DISABLE_AUTO_UPLOAD=true\n';
      fs.writeFileSync(envLocalPath, contents.endsWith('\n') || contents === '' ? contents + line : contents + '\n' + line);
      console.log('[withTVPodfilePatch] Added SENTRY_DISABLE_AUTO_UPLOAD=true to .xcode.env.local');
      return cfg;
    },
  ]);

  return config;
};
