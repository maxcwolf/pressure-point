// How keys and the other controls are named on screen.
import type { KeyAction } from '../../storage/controls';

/** What each action is called in the settings. */
export const ACTION_NAMES: Readonly<Record<KeyAction, string>> = {
  up: 'Move the camera up',
  left: 'Move the camera left',
  down: 'Move the camera down',
  right: 'Move the camera right',
  turnLeft: 'Turn the camera left',
  turnRight: 'Turn the camera right',
  rotate: 'Rotate furniture',
  build: 'Build the room planned',
  pause: 'Pause',
  speed1: 'Normal speed',
  speed2: 'Fast',
  speed3: 'Fastest',
};

/** Names for keys whose code does not say plainly what is printed on them. */
const NAMED: Readonly<Record<string, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'Num Enter',
  Backspace: 'Backspace',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

/** A key's name as printed on it, for a key kept by where it sits: KeyW is W, Digit1 is 1, Numpad1 is Num 1. */
export function keyLabel(code: string): string {
  const named = NAMED[code];
  if (named) return named;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** The autosave choice as the settings show it. */
export function autosaveLabel(seconds: number): string {
  if (!seconds) return 'Only on leaving';
  if (seconds < 60) return `Every ${seconds} seconds`;
  if (seconds === 60) return 'Every minute';
  return `Every ${seconds / 60} minutes`;
}

/** What the pause menu says about autosaving. */
export function autosaveNote(seconds: number): string {
  if (!seconds) return 'The game saves when you leave it.';
  return `The game autosaves ${autosaveLabel(seconds).toLowerCase()}.`;
}

/** The choice after this one, round to the first again after the last. */
export function nextChoice<T>(choices: readonly T[], now: T): T {
  const i = choices.indexOf(now);
  return choices[(i + 1) % choices.length] ?? now;
}
