// Brand tokens copied from src/app.html (light theme), plus the two typefaces.
import { continueRender, delayRender, staticFile } from 'remotion';

export const T = {
  bg: '#eef1ec', card: '#fbfcfa', ink: '#18201c', muted: '#5f6a63', faint: '#8b958e', line: '#dde3dc', chip: '#e3e8e2',
  accent: '#1f6b55', accentInk: '#fff', accentSoft: '#d6e9e0', accentBright: '#5cc199',
  neg: '#b0432c', negSoft: '#f5e1da', warn: '#865b0d', warnSoft: '#f3e8cf',
  sh: '0 1px 2px rgba(20,35,28,.05),0 6px 20px rgba(20,35,28,.06)',
};
export const FD = "'Bricolage Grotesque', Figtree, sans-serif"; // headlines, numbers
export const FB = "Figtree, sans-serif"; // body

const FONTS = [
  ['Bricolage Grotesque', 'Bricolage-500.ttf', '500'], ['Bricolage Grotesque', 'Bricolage-700.ttf', '700'], ['Bricolage Grotesque', 'Bricolage-800.ttf', '800'],
  ['Figtree', 'Figtree-500.ttf', '500'], ['Figtree', 'Figtree-600.ttf', '600'], ['Figtree', 'Figtree-700.ttf', '700'], ['Figtree', 'Figtree-800.ttf', '800'],
];
let loaded = false;
export function loadFonts() {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const h = delayRender('fonts');
  Promise.all(FONTS.map(([family, file, weight]) => {
    const f = new FontFace(family, `url(${staticFile('fonts/' + file)})`, { weight });
    return f.load().then(x => document.fonts.add(x));
  })).then(() => continueRender(h), e => { console.error(e); continueRender(h); });
}

// Same formatting as the app: en-IN, INR, whole rupees.
const NF = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
export const rs = n => NF.format(Math.round(n));
