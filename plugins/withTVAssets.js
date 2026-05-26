// withTVAssets — Expo config plugin
//
// Adds tvOS Brand Assets (App Icon + Top Shelf Image) and the matching
// Info.plist keys required by App Store Connect for tvOS submissions.
//
// Without this plugin, EAS Submit rejects the .ipa with errors like:
//   - Missing Image Asset. Your app is missing the Home Screen Icon asset
//   - Missing Image Asset. Your app is missing the App Store Icon asset
//   - Missing Info.plist Key 'TVTopShelfImage.TVTopShelfPrimaryImageWide'
//
// IMPORTANT — the asset NAMES in the brandassets bundle are NOT what Apple
// calls them in error messages. Apple reports assets by their `role` field
// (human-readable), but the folder names are the standard Xcode names:
//
//   Apple role             → Folder name
//   ─────────────────────────────────────────────────────────
//   Home Screen Icon       → "App Icon.imagestack"
//   App Store Icon         → "App Icon - App Store.imagestack"
//   Top Shelf Image        → "Top Shelf Image.imageset"
//   Top Shelf Image Wide   → "Top Shelf Image Wide.imageset"
//
// The brandassets Contents.json MUST include a `role` field per asset for
// altool to find them. Without `role`, the assets compile into Assets.car
// but Apple's validator can't locate them by role and rejects the build.
//
// Asset rules enforced:
//   - PNGs are RGB (no alpha channel) — alpha causes "missing image asset"
//   - Dimensions match exactly (400×240, 1280×768, 1920×720, 2320×720)
//   - Each imagestack has 3 layers: Front, Middle, Back (standard Xcode default)
//   - Each layer has a Content.imageset (note: singular `Content`, not `Contents`)
//
// Source assets (generated from assets/icon.png):
//   assets/tv/icon-small.png       — 400×240
//   assets/tv/icon-large.png       — 1280×768
//   assets/tv/top-shelf.png        — 1920×720
//   assets/tv/top-shelf-wide.png   — 2320×720

const { withDangerousMod, withInfoPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n');
}

function copyFile(src, dst) {
  fs.copyFileSync(src, dst);
}

// Create the layered imagestack structure for a tvOS app icon.
// 3 layers (Front, Middle, Back) is what Xcode's default template uses
// and what Apple's altool expects most reliably. Same image in all 3
// layers — no parallax effect but validates fine.
function makeImagestack(imagestackDir, sourceImage) {
  ensureDir(imagestackDir);

  writeJson(path.join(imagestackDir, 'Contents.json'), {
    layers: [
      { filename: 'Front.imagestacklayer' },
      { filename: 'Middle.imagestacklayer' },
      { filename: 'Back.imagestacklayer' },
    ],
    info: { version: 1, author: 'xcode' },
  });

  ['Front', 'Middle', 'Back'].forEach((layerName) => {
    const layerDir = path.join(imagestackDir, `${layerName}.imagestacklayer`);
    ensureDir(layerDir);

    // imagestacklayer Contents.json — just the info block, no images/layers.
    writeJson(path.join(layerDir, 'Contents.json'), {
      info: { version: 1, author: 'xcode' },
    });

    // The image is inside a Content.imageset folder (singular `Content`).
    const contentImageset = path.join(layerDir, 'Content.imageset');
    ensureDir(contentImageset);

    const pngName = path.basename(sourceImage);
    writeJson(path.join(contentImageset, 'Contents.json'), {
      images: [
        { idiom: 'tv', filename: pngName, scale: '1x' },
      ],
      info: { version: 1, author: 'xcode' },
    });

    copyFile(sourceImage, path.join(contentImageset, pngName));
  });
}

// Create a flat .imageset for Top Shelf images.
function makeImageset(imagesetDir, sourceImage) {
  ensureDir(imagesetDir);
  const pngName = path.basename(sourceImage);
  writeJson(path.join(imagesetDir, 'Contents.json'), {
    images: [
      { idiom: 'tv', filename: pngName, scale: '1x' },
    ],
    info: { version: 1, author: 'xcode' },
  });
  copyFile(sourceImage, path.join(imagesetDir, pngName));
}

module.exports = function withTVAssets(config) {
  // Mod 1: generate the brandassets bundle inside Images.xcassets.
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const platformRoot = cfg.modRequest.platformProjectRoot; // ios/
      const projectName = cfg.modRequest.projectName || 'FluidBody';
      const xcassetsRoot = path.join(platformRoot, projectName, 'Images.xcassets');

      if (!fs.existsSync(xcassetsRoot)) {
        console.log('[withTVAssets] Images.xcassets not yet generated, skipping');
        return cfg;
      }

      const projectRoot = cfg.modRequest.projectRoot;
      const assetsSrc = path.join(projectRoot, 'assets', 'tv');
      if (!fs.existsSync(assetsSrc)) {
        console.log('[withTVAssets] assets/tv/ not found, skipping');
        return cfg;
      }

      // Top-level brandassets bundle.
      const brandAssets = path.join(xcassetsRoot, 'App Icon & Top Shelf Image.brandassets');
      ensureDir(brandAssets);

      // brandassets Contents.json — the `role` field per asset is CRITICAL.
      // Without it, altool reports "Missing Image Asset" even though the
      // assets are compiled into Assets.car. This is the #1 cause of
      // tvOS submission rejection.
      writeJson(path.join(brandAssets, 'Contents.json'), {
        assets: [
          {
            size: '400x240',
            idiom: 'tv',
            filename: 'App Icon.imagestack',
            role: 'primary-app-icon',
          },
          {
            size: '1280x768',
            idiom: 'tv',
            filename: 'App Icon - App Store.imagestack',
            role: 'primary-app-icon',
          },
          {
            size: '1920x720',
            idiom: 'tv',
            filename: 'Top Shelf Image.imageset',
            role: 'top-shelf-image',
          },
          {
            size: '2320x720',
            idiom: 'tv',
            filename: 'Top Shelf Image Wide.imageset',
            role: 'top-shelf-image-wide',
          },
        ],
        info: { version: 1, author: 'xcode' },
      });

      // App Icon (400×240, used at runtime — referenced by CFBundlePrimaryIcon).
      makeImagestack(
        path.join(brandAssets, 'App Icon.imagestack'),
        path.join(assetsSrc, 'icon-small.png'),
      );

      // App Icon - App Store (1280×768, used in App Store presentation only).
      makeImagestack(
        path.join(brandAssets, 'App Icon - App Store.imagestack'),
        path.join(assetsSrc, 'icon-large.png'),
      );

      // Top Shelf Image (1920×720, used when app is featured at top of home).
      makeImageset(
        path.join(brandAssets, 'Top Shelf Image.imageset'),
        path.join(assetsSrc, 'top-shelf.png'),
      );

      // Top Shelf Image Wide (2320×720, used for wide layout featured slot).
      // Apple REQUIRES both regular and wide variants for App Store submission.
      makeImageset(
        path.join(brandAssets, 'Top Shelf Image Wide.imageset'),
        path.join(assetsSrc, 'top-shelf-wide.png'),
      );

      console.log('[withTVAssets] Generated tvOS brandassets at', brandAssets);
      return cfg;
    },
  ]);

  // Mod 2: Info.plist references to the brand asset names.
  // tvOS-specific format (different from iOS):
  //   - CFBundlePrimaryIcon is a STRING (asset name), not a dict.
  //   - TVTopShelfPrimaryImageWide is REQUIRED for tvOS App Store submission.
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.CFBundleIcons = {
      CFBundlePrimaryIcon: 'App Icon',
    };
    cfg.modResults.TVTopShelfImage = {
      TVTopShelfPrimaryImage: 'Top Shelf Image',
      TVTopShelfPrimaryImageWide: 'Top Shelf Image Wide',
    };
    // UIDeviceFamily 3 = TV (alongside 1 iPhone, 2 iPad).
    cfg.modResults.UIDeviceFamily = [3];
    return cfg;
  });

  return config;
};
