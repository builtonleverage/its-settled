# It's Settled: launch video

A Remotion (React) project, kept separate from the app. Silent, captions burned in.

```bash
cd launch-video
npm install
# 1. Put your link in src/Video.jsx:  export const INVITE_LINK = 'https://…';
# 2. Render both sizes:
npm run render     # → out/its-settled-9x16.mp4 (1080x1920) and out/its-settled-1x1.mp4 (1080x1080)
npm run studio     # optional: preview and scrub in the browser
```

- Scenes live in `src/scenes/` (one file each); the timeline is `SCENES` in `src/Video.jsx`.
- App screens are rebuilt in `src/app-ui.jsx` from the CSS in `../src/app.html`. Brand tokens are in `src/brand.js`.
- Fonts (Bricolage Grotesque, Figtree; SIL OFL) are bundled in `public/fonts/`.
- `node scripts/stills.mjs stills 100 300 …` renders PNG stills of given frames for both sizes.
- No network for Remotion's Chrome download? Set `REMOTION_CHROME=/path/to/chrome-headless-shell`.
