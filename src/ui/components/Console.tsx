// Top middle, under the announcements: the cheat console, opened with ~ once it is switched on in the settings.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

import { CONSOLE_KEY } from '../../storage/controls';
import { css } from '../../styled-system/css';
import { panelCard } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { consoleNote, recallStep } from '../lib/console';
import { cx } from '../lib/cx';

/** The console: a panel at the top middle, dropping into place as it opens. */
const consoleLook = css({
  top: 'below-bar',
  left: 'half',
  transform: 'translateX(-50%)',
  w: '[min(560px, calc(var(--vw) - 560px))]',
  minW: 'panel.notice',
  py: '10',
  px: '12',
  animation: '[drop {durations.normal} {easings.out}]',
});

/** What the console has said, latest at the bottom: what was typed in bold, what worked in green, what did not in red. */
const logLook = css({
  listStyle: 'none',
  m: '0',
  p: '0',
  maxH: 'panel.console',
  overflowY: 'auto',
  fontSize: '13',
  lineHeight: 'snug',
  userSelect: 'text',
  WebkitUserSelect: 'text',
  '& li': { py: '1', px: '0', whiteSpace: 'pre-wrap' },
  '& li.typed': { fontWeight: 'bold' },
  '& li.typed::before': { content: "'› '", opacity: 'faint' },
  '& li.good': { color: 'good.strong' },
  '& li.bad': { color: 'bad.solid' },
  '& li.hint': { opacity: 'quiet' },
});

/** The line to type a command in, after a prompt. */
const lineLook = css({
  display: 'flex',
  alignItems: 'center',
  gap: '6',
  mt: '6',
  py: '4',
  px: '10',
  bg: 'bg.card',
  border: 'outline.thin',
  borderRadius: '10',
  fontWeight: 'heavy',
});

/** The command being typed. */
const commandBox = css({
  flex: '1',
  minW: '0',
  border: 'none',
  outlineStyle: 'none',
  bg: 'transparent',
  font: 'inherit',
  fontWeight: 'medium',
  fontSize: '14',
  color: 'inherit',
});

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
    <div id="console" class={cx(panelCard(), consoleLook)}>
      <ol ref={log} class={logLook} aria-live="polite">
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
      <label class={lineLook}>
        <span aria-hidden="true">›</span>
        <input
          ref={input}
          class={commandBox}
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
