# Screenshots

These images are referenced from the [root README](../../README.md). Capture them with the dev server running on a freshly synced account so the dashboard has real data.

## Recommended capture settings

- **Viewport:** 1600 × 1000 (or 1920 × 1200 if you have an ultrawide).
- **Theme:** dark (the default).
- **Browser:** any Chromium / WebKit. Disable browser extensions that draw on the page.
- **Format:** PNG, lossless.
- **Mask:** if any private repo / org name shows, blur it before committing.

## Files to provide

| File | What to capture |
| --- | --- |
| `digest.png` | Digest scope landing — heatmap + stat tiles + most active repos. Pick a 7d window so the lists are populated. |
| `repos.png` | All repos scope — chip filters visible, scan grid populated. |
| `repo-detail.png` | Repo detail — Overview or Commits tab with branch chips visible. |
| `login.png` | Token entry screen with the scope explainer panel. |
| `config-cache.png` | Settings → Cache panel showing TTL groups + counts. |

Once the PNGs land in this folder, the README will start rendering them automatically.
