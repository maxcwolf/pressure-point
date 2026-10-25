// Top center: what the tool in hand does, as a row of chips, why it cannot be used here, and what an item in hand
// would change, with a rug's patterns to pick from.

import { toolIcon } from '../../app/tools/hints';
import type { IconId } from '../../core/data';
import { css } from '../../styled-system/css';
import { useGame } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { type HintChip, hintChips } from '../lib/hint-chips';
import { placeEffects } from '../lib/item-stats';
import { IconText } from './common/Icon';
import { RugPatterns } from './common/RugPatterns';

/** Top center, kept to most of the window's width. */
const column = css({
  top: '[66px]',
  left: '[50%]',
  transform: '[translateX(-50%)]',
  maxW: '[calc(var(--vw) * 0.7)]',
});

/** A cream pill ringed in teal. */
const pill = css.raw({
  bg: 'cream',
  border: '[3px solid {colors.teal}]',
  borderRadius: '[14px]',
  py: '[7px]',
  px: '[16px]',
  fontSize: '15',
  fontWeight: '[500]',
  boxShadow: 'raised',
  textAlign: 'center',
});

/** The hint, ringed in red while the tool cannot be used where it is. */
const hint = css(pill, { '&.bad': { borderColor: 'red' } });

/** The patterns to pick from while a rug is in hand, which can be clicked though the hint cannot. */
const rugPicker = css(pill, { mt: 's', py: '[5px]', px: 'l', pointerEvents: 'auto' });

/** The hint's phrases, each a chip: the name first, then what it costs, the keys, and who the squares are for. */
const phrases = css({
  listStyle: 'none',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '[5px]',
  m: 'none',
  p: 'none',
});

/**
 * A phrase in a white frame: the name bare and bigger, what it costs in gold. Its kind is a class, and `legend` is for
 * the end-to-end tests to find the squares' phrases by.
 */
const phrase = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '[5px]',
  fontSize: '13',
  border: '[1.5px solid {colors.ink.25}]',
  bg: 'white',
  borderRadius: 'control',
  py: '[1px]',
  px: 'm',
  '&.name': { fontSize: '15', fontWeight: 'bold', border: '[none]', bg: '[none]', p: '[0 4px 0 0]' },
  '&.cost': { bg: 'gold-tint', borderColor: 'gold', fontWeight: 'bold' },
});

/** A key, drawn as a key. */
const keyCap = css({
  font: 'inherit',
  fontSize: '12',
  fontWeight: 'bold',
  lineHeight: '[1.4]',
  minW: '[18px]',
  textAlign: 'center',
  bg: 'cream',
  border: '[1.5px solid {colors.navy}]',
  borderBottomWidth: '[3px]',
  borderRadius: '[6px]',
  p: '[0 5px]',
});

/** A square in the color the scene draws it in. `square` is for the end-to-end tests to find it by. */
const square = css({
  w: '[11px]',
  h: '[11px]',
  borderRadius: '[3px]',
  border: '[1.5px solid {colors.ink.50}]',
  '&.staff': { bg: '[#9b6bff]' },
  '&.guest': { bg: '[#ff8a3c]' },
});

/**
 * Why the tool cannot be used here, in red under the phrases. A click turned down pulses it, so it is seen as well as
 * heard, or, with less motion asked for, flashes it without moving. `refused` is for the end-to-end tests to find it
 * by.
 */
const problem = css({
  display: 'block',
  mt: 'xs',
  color: 'red',
  fontWeight: 'bold',
  '&.refused': {
    animation: 'hint-refused 0.4s ease-out',
    _motionReduce: { animation: 'hint-refused-flash 0.4s ease-out' },
  },
});

/** What an item in hand would change where it is about to go. */
const effectList = css({
  listStyle: 'none',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '[5px]',
  m: '[6px 0 1px]',
  p: 'none',
});

/** One change, in a white frame: green for the better, red for the worse. */
const effect = css({
  fontSize: '13',
  fontWeight: '[500]',
  border: '[1.5px solid {colors.ink.35}]',
  bg: 'white',
  borderRadius: 'control',
  p: '[1px 8px]',
  '&.good': { bg: 'good-bg', borderColor: 'green', color: 'good' },
  '&.bad': { bg: 'bad-bg', borderColor: 'red', color: 'bad' },
});

/** One phrase of the hint as a chip: the name with the icon of the tool in hand, a key as a key, a square's color. */
function Chip({ chip, icon }: { chip: HintChip; icon: IconId | null }) {
  switch (chip.kind) {
    case 'name':
      return icon ? <IconText id={icon}>{chip.text}</IconText> : <>{chip.text}</>;
    case 'key':
      return (
        <>
          <kbd class={keyCap}>{chip.key}</kbd> {chip.text}
        </>
      );
    case 'legend':
      return (
        <>
          <i
            class={cx('square', square, chip.squares)}
            role="img"
            aria-label={`${chip.squares === 'staff' ? 'purple' : 'orange'} squares:`}
          />
          {chip.text}
        </>
      );
    default:
      return <>{chip.text}</>;
  }
}

/** The hint for the tool in hand, what an item in hand would change, and a new rug's patterns to choose from. */
export function ToolHint() {
  const { sim, tools } = useGame();
  const effects = tools.preview ? placeEffects(sim, tools.preview) : [];
  const icon = toolIcon(tools.tool);
  return (
    <div id="hint" class={column}>
      {tools.hint && (
        <div class={cx(hint, tools.problem && 'bad')}>
          <ul class={phrases}>
            {hintChips(tools.hint).map((chip) => (
              <li key={chip.text} class={cx(phrase, chip.kind)}>
                <Chip chip={chip} icon={icon} />
              </li>
            ))}
          </ul>
          {tools.problem && (
            <b key={tools.refusals} class={cx(problem, tools.justRefused && 'refused')}>
              {tools.problem}
            </b>
          )}
          {effects.length > 0 && (
            <ul class={effectList}>
              {effects.map((e) => (
                <li key={e.text} class={cx(effect, e.tone)}>
                  <IconText id={e.icon}>{e.text}</IconText>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {tools.holdingRug && (
        <div class={rugPicker}>
          <RugPatterns
            current={tools.rugPattern}
            onPick={(id) => {
              tools.pickRugPattern(id);
            }}
          />
        </div>
      )}
    </div>
  );
}
