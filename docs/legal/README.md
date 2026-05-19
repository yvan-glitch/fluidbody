# Legal pages — hosting instructions

This folder contains the legal pages required by Apple App Store and Google Play:

- `terms-of-service.md` — Terms of Service (FR, canonical version)
- `terms-of-service-en.md` — Terms of Service (EN)

The Privacy Policy is hosted separately at https://yvan-glitch.github.io/fluidbody-privacy/.

The legal URLs consumed by the app live in `app.json` under `expo.extra.legal`. Change them there if you move hosting — no native rebuild required, the values are read at runtime.

## Current URLs (configured in app.json)

| Document            | URL                                                          |
| ------------------- | ------------------------------------------------------------ |
| Privacy Policy      | https://yvan-glitch.github.io/fluidbody-privacy/             |
| Terms of Service FR | https://yvan-glitch.github.io/fluidbody-privacy/terms/       |
| Terms of Service EN | https://yvan-glitch.github.io/fluidbody-privacy/terms/en/    |

## How to publish (GitHub Pages, reuses the existing `fluidbody-privacy` repo)

The privacy site is hosted on the GitHub repo `yvan-glitch/fluidbody-privacy` (GitHub Pages, branch `main`, root `/`). Reuse the same repo by adding a `/terms/` sub-folder.

### One-time setup

```bash
# Clone or pull the privacy repo locally (anywhere outside this app repo)
git clone https://github.com/yvan-glitch/fluidbody-privacy.git
cd fluidbody-privacy

# Create the terms sub-folder
mkdir -p terms terms/en
```

### Deploy a new version

Whenever this folder is updated, regenerate the published HTML and push:

```bash
# From inside the fluidbody-privacy repo:

# 1. Copy the markdown sources from the app repo
cp /path/to/fluidbody/docs/legal/terms-of-service.md    terms/index.md
cp /path/to/fluidbody/docs/legal/terms-of-service-en.md terms/en/index.md

# 2. (Optional but recommended) Render to HTML so links work in any browser.
#    GitHub Pages with the default Jekyll theme will render .md files
#    automatically; alternatively you can convert with pandoc:
pandoc terms/index.md    -s -o terms/index.html    --metadata title="Conditions Générales d'Utilisation — FluidBody"
pandoc terms/en/index.md -s -o terms/en/index.html  --metadata title="Terms of Service — FluidBody"

# 3. Commit and push — GitHub Pages auto-deploys
git add terms
git commit -m "docs: publish Terms of Service v1.0 (FR + EN)"
git push origin main
```

After ~30 seconds the pages should be live at:
- https://yvan-glitch.github.io/fluidbody-privacy/terms/
- https://yvan-glitch.github.io/fluidbody-privacy/terms/en/

### Verify

```bash
curl -I https://yvan-glitch.github.io/fluidbody-privacy/terms/
curl -I https://yvan-glitch.github.io/fluidbody-privacy/terms/en/
# Both should return HTTP/2 200
```

## Workflow when updating the Terms

1. Edit `terms-of-service.md` and `terms-of-service-en.md` in this folder.
2. Bump the `Version` and `Last updated` date in both files.
3. Open a PR in the app repo, get it merged.
4. After merge, repeat the **Deploy a new version** steps above to refresh the hosted copy.
5. If the changes are substantial (new clauses, change of scope), App Store Connect's "Privacy Policy URL" field does not need to change, but you should re-acknowledge the Apple Review compliance questionnaire on the next submission.

## Compliance notes

- Apple App Store requires both a Privacy Policy URL **and** a Terms of Use URL (or "EULA") for any app with auto-renewing subscriptions (Guideline 3.1.2). The default Apple EULA is acceptable in lieu of custom Terms — but having custom Terms is safer for the medical disclaimer and Swiss law clauses we rely on.
- The URLs are surfaced in the app via `app.json` → `expo.extra.legal` and read at runtime through `Constants.expoConfig.extra.legal`. Updating the URL in `app.json` does **not** require a native rebuild — it ships in the JS bundle via Expo OTA updates.
