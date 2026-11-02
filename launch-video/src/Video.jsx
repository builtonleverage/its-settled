// Swap in your real invite link here, then run `npm run render` (renders both sizes).
export const INVITE_LINK = '{{INVITE_LINK}}';

import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { loadFonts } from './brand.js';
import { Backdrop, Layout, Whip } from './kit.jsx';
import { S1Chaos } from './scenes/S1Chaos.jsx';
import { S2Title } from './scenes/S2Title.jsx';
import { S3Add } from './scenes/S3Add.jsx';
import { S4Simplify } from './scenes/S4Simplify.jsx';
import { S5Monthly } from './scenes/S5Monthly.jsx';
import { S6Guests } from './scenes/S6Guests.jsx';
import { S7Offline } from './scenes/S7Offline.jsx';
import { S8Telegram } from './scenes/S8Telegram.jsx';
import { S9Promise } from './scenes/S9Promise.jsx';
import { S10End } from './scenes/S10End.jsx';

loadFonts();

// [component, seconds, whip in, whip out]
export const SCENES = [
  [S1Chaos, 4, false, false],   // 0–4    chaos (hard cut into the sweep)
  [S2Title, 3, false, true],    // 4–7    title
  [S3Add, 4, true, true],       // 7–11   add in two taps
  [S4Simplify, 5, true, true],  // 11–16  simplify payments
  [S5Monthly, 4, true, true],   // 16–20  monthly bills
  [S6Guests, 4, true, true],    // 20–24  guests
  [S7Offline, 3, true, true],   // 24–27  offline
  [S8Telegram, 3, true, false], // 27–30  telegram
  [S9Promise, 3, false, true],  // 30–33  promise
  [S10End, 3, true, false],     // 33–36  ending
];
export const FPS = 30;
export const TOTAL = SCENES.reduce((a, s) => a + s[1] * FPS, 0);

export function Video({ inviteLink = INVITE_LINK }) {
  const { width: W, height: H } = useVideoConfig();
  let from = 0;
  return (
    <Layout.Provider value={{ tall: H > W, W, H }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Backdrop />
        {SCENES.map(([C, sec, wIn, wOut], i) => {
          const dur = sec * FPS, start = from; from += dur;
          return (
            <Sequence key={i} from={start} durationInFrames={dur} name={C.name}>
              <Whip dur={dur} noIn={!wIn} noOut={!wOut}><C inviteLink={inviteLink} /></Whip>
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </Layout.Provider>
  );
}
