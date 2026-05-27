// withLiquidGlass — Expo config plugin that bridges a custom Swift module
// exposing the iOS 26 UIGlassEffect ("Liquid Glass") to React Native.
//
// On every `expo prebuild`, this plugin:
//   1. Copies the Swift / Obj-C source files from plugins/LiquidGlass/
//      into ios/<projectName>/LiquidGlass/.
//   2. Registers those files in the Xcode project so the target actually
//      compiles them (without this, the files sit on disk and Xcode
//      silently ignores them — the JS bridge then resolves to a fake
//      component and we fall back to BlurView at runtime).
//
// The matching React Native component lives at src/components/LiquidGlass.js
// and feature-detects iOS 26 at runtime, falling back to expo-blur for
// older OS versions (and tvOS / Android).
//
// Implementation note: we bypass xcodeProject.addSourceFile because its
// internal addToPluginsPbxGroup() crashes on Expo-generated projects that
// don't ship a "Plugins" PBXGroup. We assemble PbxFile entries manually
// and wire them into the file reference / build file / sources build phase
// / target group sections directly.

const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const PbxFile = require('xcode/lib/pbxFile');
const fs = require('fs');
const path = require('path');

const SOURCE_FILES = [
  'LiquidGlassView.swift',
  'LiquidGlassViewManager.swift',
  'LiquidGlass.m',
];

const GROUP_NAME = 'LiquidGlass';

function copySources(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const projectName = cfg.modRequest.projectName || 'FluidBody';
      const targetDir = path.join(platformRoot, projectName, GROUP_NAME);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const sourceDir = path.join(__dirname, GROUP_NAME);
      for (const file of SOURCE_FILES) {
        const src = path.join(sourceDir, file);
        const dst = path.join(targetDir, file);
        if (!fs.existsSync(src)) {
          throw new Error(`[withLiquidGlass] missing source file: ${src}`);
        }
        fs.copyFileSync(src, dst);
      }

      // eslint-disable-next-line no-console
      console.log(`[withLiquidGlass] copied ${SOURCE_FILES.length} source files → ${targetDir}`);
      return cfg;
    },
  ]);
}

// Find an existing child PBXGroup by name under the given parent, or create
// one. Returns the group's UUID. Looks up by name so reruns are idempotent.
function ensureChildGroup(xcodeProject, parentGroupKey, name) {
  const parent = xcodeProject.getPBXGroupByKey(parentGroupKey);
  if (parent && parent.children) {
    for (const child of parent.children) {
      const candidate = xcodeProject.getPBXGroupByKey(child.value);
      if (candidate && (candidate.name === name || candidate.path === name)) {
        return child.value;
      }
    }
  }
  const newGroup = xcodeProject.addPbxGroup([], name, name);
  if (parent && parent.children) {
    parent.children.push({ value: newGroup.uuid, comment: name });
  }
  return newGroup.uuid;
}

// Manually attach a source file to the project — bypasses addSourceFile()
// which calls addToPluginsPbxGroup() and crashes on Expo projects that
// lack a "Plugins" group.
function attachSourceFile(xcodeProject, relPath, groupKey, targetUuid) {
  if (xcodeProject.hasFile && xcodeProject.hasFile(relPath)) {
    return;
  }
  const pbxFile = new PbxFile(relPath, { target: targetUuid });
  pbxFile.uuid = xcodeProject.generateUuid();
  pbxFile.fileRef = xcodeProject.generateUuid();
  pbxFile.target = targetUuid;

  xcodeProject.addToPbxFileReferenceSection(pbxFile);
  xcodeProject.addToPbxBuildFileSection(pbxFile);
  xcodeProject.addToPbxSourcesBuildPhase(pbxFile);
  xcodeProject.addToPbxGroup(pbxFile, groupKey);
}

function registerInXcode(config) {
  return withXcodeProject(config, (cfg) => {
    const xcodeProject = cfg.modResults;
    const projectName = cfg.modRequest.projectName || 'FluidBody';

    const target = xcodeProject.pbxTargetByName(projectName);
    if (!target) {
      // eslint-disable-next-line no-console
      console.warn(`[withLiquidGlass] target ${projectName} not found, skipping Xcode wiring`);
      return cfg;
    }
    const targetUuid = target.uuid;

    // Walk down: project root → main group → projectName group → LiquidGlass group.
    // The Swift sources sit on disk at ios/<projectName>/LiquidGlass/, so the
    // Xcode group tree should mirror that.
    const firstProject = xcodeProject.getFirstProject().firstProject;
    const mainGroupKey = firstProject.mainGroup;
    const mainGroup = xcodeProject.getPBXGroupByKey(mainGroupKey);

    // Locate the project's source group (named after projectName). It contains
    // AppDelegate.swift, Info.plist, etc.
    let projectGroupKey = null;
    if (mainGroup && mainGroup.children) {
      for (const child of mainGroup.children) {
        const candidate = xcodeProject.getPBXGroupByKey(child.value);
        if (candidate && (candidate.name === projectName || candidate.path === projectName)) {
          projectGroupKey = child.value;
          break;
        }
      }
    }
    if (!projectGroupKey) {
      // eslint-disable-next-line no-console
      console.warn(`[withLiquidGlass] could not find ${projectName} PBXGroup, falling back to main group`);
      projectGroupKey = mainGroupKey;
    }

    const liquidGlassGroupKey = ensureChildGroup(xcodeProject, projectGroupKey, GROUP_NAME);

    for (const file of SOURCE_FILES) {
      // Path relative to the .xcodeproj — Xcode resolves group sources
      // against the group's path, but PbxFile stores the path as given.
      const relPath = `${projectName}/${GROUP_NAME}/${file}`;
      attachSourceFile(xcodeProject, relPath, liquidGlassGroupKey, targetUuid);
    }

    // eslint-disable-next-line no-console
    console.log(`[withLiquidGlass] registered ${SOURCE_FILES.length} sources in Xcode target ${projectName}`);
    return cfg;
  });
}

module.exports = function withLiquidGlass(config) {
  config = copySources(config);
  config = registerInXcode(config);
  return config;
};
