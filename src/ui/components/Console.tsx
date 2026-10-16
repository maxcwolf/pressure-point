// Top middle, under the announcements: the cheat console, opened with ~ once it is switched on in the settings.

import './Console.css';

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

import { CONSOLE_KEY } from '../../storage/controls';
import { useGame, useHud } from '../hooks/use-hud';
import { consoleNote, recallStep } from '../lib/console';

/** The cheat console: what it has said, and a line to type the next command in. */
export function Console() {
  const hud = useHud();
  const { sim } = useGame();
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLOListElement>(null);
  const [text, setText] = useState('');
  /** How far back through the commands typed the up arrow has gone, or null while typing a new one. */
  const [back, setBack] = useState<number | null>(null);
  const open = hud.consoleOpen;

  // typing goes straight into the console as it opens
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  // the latest line in view
  useLayoutEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hud.consoleLines.length, open]);

  if (!open) return null;

  /** Bring back a command typed before: -1 for an older one, 1 for a newer one. */
  const recall = (step: number) => {
    const at = recallStep(hud.consoleHistory.length, back, step);
    setBack(at);
    setText(at === null ? '' : (hud.consoleHistory[at] ?? ''));
  };

  /** Keys the console keeps to itself: Enter runs, the arrows recall, and Esc or ~ close it. */
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.code === CONSOLE_KEY) {
      e.preventDefault();
      e.stopPropagation();
      input.current?.blur();
      hud.toggleConsole();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      hud.runCommand(text);
      setText('');
      setBack(null);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      recall(e.key === 'ArrowUp' ? -1 : 1);
    }
  };

  const note = consoleNote(sim.s);
  return (
    <div id="console" class="panel">
      <ol ref={log} class="console-log" aria-live="polite">
        {hud.consoleLines.length ? (
          hud.consoleLines.map((l) => (
            <li key={l.id} class={l.kind}>
              {l.text}
            </li>
          ))
        ) : (
          <li class="hint">Type help for the list of commands.</li>
        )}
      </ol>
      <label class="console-line">
        <span aria-hidden="true">›</span>
        <input
          ref={input}
          type="text"
          aria-label="Cheat command"
          spellcheck={false}
          autocomplete="off"
          value={text}
          onInput={(e) => {
            setText(e.currentTarget.value);
          }}
          onKeyDown={onKey}
        />
      </label>
      {note && <p class="sub">{note}</p>}
    </div>
  );
}
