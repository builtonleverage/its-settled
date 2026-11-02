import { Config } from '@remotion/cli/config';
Config.setEntryPoint('src/index.jsx');
Config.setVideoImageFormat('png');
Config.setChromiumOpenGlRenderer('angle');
// Optional: use a local Chrome instead of Remotion's download (e.g. REMOTION_CHROME=/path/to/chrome-headless-shell).
if (process.env.REMOTION_CHROME) Config.setBrowserExecutable(process.env.REMOTION_CHROME);
