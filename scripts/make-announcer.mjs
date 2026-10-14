// Turns the announcer's clean recordings in brand/announcer/ into the clips the game plays, as if
// heard over the center's speakers. Run `yarn announcer` after adding or changing a recording.
// Uses macOS's afconvert to read the recordings and to write the finished clips.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { paSpeaker, readWav, writeWav } from './pa-speaker.mjs';

const FROM = 'brand/announcer';
const TO = 'src/sounds/announcer';
// a speaker this tinny carries nothing above 4 kHz, so half the usual sample rate loses nothing
const RATE = 22050;

const work = mkdtempSync(path.join(tmpdir(), 'announcer-'));
mkdirSync(TO, { recursive: true });
try {
  for (const file of readdirSync(FROM).filter((f) => /\.(mp3|wav|m4a|aiff?)$/i.test(f))) {
    const name = path.parse(file).name;
    const clean = path.join(work, `${name}.wav`);
    const tinny = path.join(work, `${name}-pa.wav`);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${RATE}`, '-c', '1', path.join(FROM, file), clean]);
    const { rate, samples } = readWav(readFileSync(clean));
    writeFileSync(tinny, writeWav(paSpeaker(samples, rate), rate));
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', tinny, path.join(TO, `${name}.m4a`)]);
    console.log(`${TO}/${name}.m4a`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
