import React from 'react';
import { Composition } from 'remotion';
import { FPS, TOTAL, Video } from './Video.jsx';

export function Root() {
  return (
    <>
      <Composition id="ItsSettled9x16" component={Video} width={1080} height={1920} fps={FPS} durationInFrames={TOTAL} />
      <Composition id="ItsSettled1x1" component={Video} width={1080} height={1080} fps={FPS} durationInFrames={TOTAL} />
    </>
  );
}
