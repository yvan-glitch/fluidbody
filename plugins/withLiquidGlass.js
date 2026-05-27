// withLiquidGlass — Expo config plugin that bridges a custom Swift module
// exposing the iOS 26 UIGlassEffect ("Liquid Glass") to React Native.
//
// On every `expo prebuild`, this plugin:
//   1. Copies the Swift / Obj-C source files from plugins/LiquidGlass/
//      into ios/<projectName>/LiquidGlass/.
//   2. Registers those files in the Xcode project so the target actually
//      compiles them. We bypass xcodeProject.addSourceFile because its
//      internal addToPluginsPbxGroup() crashes on Expo-generated projects
//      that lack a "Plugins" PBXGroup; we assemble the entries by hand.
//
// PATH RESOLUTION (the part that bit us once already):
//
//   Xcode resolves a file's on-disk location by concatenating
//   <parent group path> + <file path>. Each PBXGroup contributes ITS
//   own `path` (relative to whichever group is above it).
//
//   So we keep the file's `path` to the BARE FILENAME, and put the
//   directory chain on the group:
//     - If the existing project group (e.g. "FluidBody") is found:
//         LiquidGlass group  → path = 'LiquidGlass'    (under FluidBody)
//         Files              → path = '<filename>'     (under LiquidGlass)
//         Resolved:  FluidBody / LiquidGlass / <file>     ✓
//     - Fallback (FluidBody group not found):
//         LiquidGlass group  → path = 'FluidBody/LiquidGlass'  (under main)
//         Files              → path = '<filename>'
//         Resolved:  FluidBody / LiquidGlass / <file>     ✓
//
//   The previous version set path on BOTH the group and the files, which
//   doubled the prefix and produced `LiquidGlass/FluidBody/LiquidGlass/<file>`
//   in the pbxproj — Xcode then couldn't locate the sources and the
//   compile step failed (EAS iPhone build #84).

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

// Strip surrounding double quotes the xcode lib sometimes leaves on string
// values when round-tripping the pbxproj.
function unquote(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/^"(.*)"$/, '$1');
}

// Walk the entire PBXGroup section to find a group whose name OR path
// matches the target. More robust than navigating from mainGroup.children
// because PBXGroup entries can live anywhere in the dictionary.
function findGroupKeyByNameOrPath(xcodeProject, target) {
  const groups = xcodeProject.hash.project.objects['PBXGroup'];
  if (!groups) return null;
  for (const key of Object.keys(groups)) {
    if (key.endsWith('_comment')) continue;
    const group = groups[key];
    if (!group || typeof group !== 'object') continue;
    if (unquote(group.name) === target || unquote(group.path) === target) {
      return key;
    }
  }
  return null;
}

// Manually attach a source file to the project — bypasses addSourceFile()
// which calls addToPluginsPbxGroup() and crashes on Expo projects that
// lack a "Plugins" group. The file's `path` is the bare basename; the
// parent group's `path` carries the on-disk prefix.
function attachSourceFile(xcodeProject, basename, groupKey, targetUuid) {
  if (xcodeProject.hasFile && xcodeProject.hasFile(basename)) {
    // hasFile matches on the basename inside the file reference section;
    // because we always store path=basename, this is enough to dedupe.
    return;
  }
  const pbxFile = new PbxFile(basename, { target: targetUuid });
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

    // Try to find the existing project source group. Expo names it after
    // projectName, with either `name` or `path` set to that string.
    const projectGroupKey = findGroupKeyByNameOrPath(xcodeProject, projectName);

    // Build (or reuse) the LiquidGlass group. The on-disk target directory
    // is ios/<projectName>/<GROUP_NAME>/, so the resolved Xcode path needs
    // to land at `<projectName>/<GROUP_NAME>` from the iOS project root.
    //
    // Xcode resolves each group as <parent.path>/<my.path>. We figure out
    // what `my.path` has to be by inspecting how much of the target prefix
    // the parent already contributes. The Expo-generated FluidBody group
    // is a LOGICAL group (name only, no path) — so files inside it carry
    // their own full prefix. That means we usually keep the full
    // `FluidBody/LiquidGlass` on our own group's path.
    let liquidGlassGroupKey = findGroupKeyByNameOrPath(xcodeProject, GROUP_NAME);
    if (!liquidGlassGroupKey) {
      const mainGroupKey = xcodeProject.getFirstProject().firstProject.mainGroup;
      const parentKey = projectGroupKey || mainGroupKey;
      const parent = xcodeProject.getPBXGroupByKey(parentKey);
      const parentPath = parent ? unquote(parent.path) : null;
      const targetDirPath = `${projectName}/${GROUP_NAME}`;

      let groupPath = targetDirPath;
      if (parentPath && parentPath !== '' && parentPath !== '.') {
        const prefix = parentPath.replace(/\/$/, '') + '/';
        if (targetDirPath === parentPath) {
          groupPath = '.';
        } else if (targetDirPath.startsWith(prefix)) {
          groupPath = targetDirPath.slice(prefix.length);
        }
        // else: parent path doesn't match our target — fall back to full
        // path, which is technically wrong but at least observable.
      }

      const newGroup = xcodeProject.addPbxGroup([], GROUP_NAME, groupPath);
      liquidGlassGroupKey = newGroup.uuid;

      if (parent) {
        if (!Array.isArray(parent.children)) parent.children = [];
        if (!parent.children.some((c) => c.value === liquidGlassGroupKey)) {
          parent.children.push({ value: liquidGlassGroupKey, comment: GROUP_NAME });
        }
      }

      // eslint-disable-next-line no-console
      console.log(
        `[withLiquidGlass] created PBXGroup "${GROUP_NAME}" (path="${groupPath}", ` +
          `parent="${projectGroupKey ? projectName : 'mainGroup'}", ` +
          `parentPath="${parentPath || ''}") → resolves to ${targetDirPath}`,
      );
    }

    for (const file of SOURCE_FILES) {
      attachSourceFile(xcodeProject, file, liquidGlassGroupKey, targetUuid);
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
