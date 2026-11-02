// Builds dist/demo.html: the whole app running in demo mode with no server, as one file.
// Used for the hosted preview; the same page is served live at /demo by the Worker.
//   node scripts/build-demo.mjs            → full HTML document
//   node scripts/build-demo.mjs --fragment → body-only fragment (for hosts that add their own <html>/<head>)
import fs from 'fs';
import * as core from '../src/core.js';

const fragment = process.argv.includes('--fragment');
const config = { name: "It's Settled", currency: 'INR', locale: 'en-IN', bot: null };
let html = fs.readFileSync(new URL('../src/app.html', import.meta.url), 'utf8')
  .replace('/*__CORE__*/', () => Object.values(core).map(f => f.toString()).join('\n'))
  .replace('/*__CONFIG__*/', () => `const CONFIG = ${JSON.stringify(config)};`)
  .replaceAll('__APP_NAME__', config.name + ' Demo')
  .replace('const FORCE_DEMO = false;', 'const FORCE_DEMO = true;');
if (!html.includes('const FORCE_DEMO = true;')) throw new Error('FORCE_DEMO flag not found in app.html');

if (fragment) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1], body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  const keep = head.split('\n').filter(l => !/<meta charset|<meta name="viewport"|<meta name="theme-color"|rel="manifest"|rel="icon"/.test(l)).join('\n');
  html = keep.trim() + '\n' + body.trim() + '\n';
}
fs.mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
const out = new URL(`../dist/${fragment ? 'demo-fragment' : 'demo'}.html`, import.meta.url);
fs.writeFileSync(out, html);
console.log('wrote', out.pathname, (html.length / 1024).toFixed(1) + ' KB');
