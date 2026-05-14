# Landing page

Static marketing landing for devcompass. Deployed to GitHub Pages by `.github/workflows/pages.yml`.

The actual app (the SPA) lives on Vercel — this folder does **not** ship the app. Keep the contents here pure HTML/CSS so Pages can serve it without any build step.

## Files

- `index.html` — single-page landing (hero, features, screenshots, privacy, footer).
- `style.css` — design system + responsive rules.
- `screenshots/` — published copies of the screenshots in `docs/screenshots/`. The Pages workflow copies them in at build time, so don't commit them here.

## Editing

Open `index.html` in any browser — no build needed. To preview the same path Pages uses (`/devcompass/`), serve the folder with any static server:

```bash
npx serve landing
```

If you change the screenshots paths, update both the landing references (`screenshots/foo.png`) and the workflow copy step.
