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
  top: 'below-bar',
  left: 'half',
  transform: '[translateX(-50%)]',
  maxW: '[calc(var(--vw) * 0.7)]',
});

/** A cream pill ringed in teal. */
const pill = css.raw({
  bg: 'bg.panel',
  border: '[{borderWidths.thick} solid {colors.accent}]',
  borderRadius: '14',
  py: '6',
  px: '16',
  fontSize: '15',
  fontWeight: 'medium',
  boxShadow: 'raised',
  textAlign: 'center',
});

/** The hint, ringed in red while the tool cannot be used where it is. */
const hint = css(pill, { '&.bad': { borderColor: 'bad.solid' } });

/** The patterns to pick from while a rug is in hand, which can be clicked though the hint cannot. */
const rugPicker = css(pill, { mt: '6', py: '4', px: '12', pointerEvents: 'auto' });

/** The hint's phrases, each a chip: the name first, then what it costs, the keys, and who the squares are for. */
const phrases = css({
  listStyle: 'none',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '4',
  m: '0',
  p: '0',
});

/**
 * A phrase in a white frame: the name bare and bigger, what it costs in gold. Its kind is a class, and `legend` is for
 * the end-to-end tests to find the squares' phrases by.
 */
const phrase = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4',
  fontSize: '13',
  border: '[{borderWidths.fine} solid {colors.border}]',
  bg: 'bg.card',
  borderRadius: '8',
  py: '1',
  px: '8',
  '&.name': { fontSize: '15', fontWeight: 'bold', border: 'none', bg: '[none]', p: '0', pr: '4' },
  '&.cost': { bg: 'highlight.bg', borderColor: 'highlight', fontWeight: 'bold' },
});

/** A key, drawn as a key. */
const keyCap = css({
  font: 'inherit',
  fontSize: '12',
  fontWeight: 'bold',
  lineHeight: 'normal',
  minW: '16',
  textAlign: 'center',
  bg: 'control',
  border: 'outline.fine',
  borderBottomWidth: 'thick',
  borderRadius: '6',
  py: '0',
  px: '4',
});

/** A square in the color the scene draws it in. `square` is for the end-to-end tests to find it by. */
const square = css({
  w: '10',
  h: '10',
  borderRadius: '2',
  border: '[{borderWidths.fine} solid {colors.border.bold}]',
  '&.staff': { bg: 'scene.staff' },
  '&.guest': { bg: 'scene.guest' },
});

/**
 * Why the tool cannot be used here, in red under the phrases. A click turned down pulses it, so it is seen as well as
 * heard, or, with less motion asked for, flashes it without moving. `refused` is for the end-to-end tests to find it
 * by.
 */
const problem = css({
  display: 'block',
  mt: '4',
  color: 'bad.solid',
  fontWeight: 'bold',
  '&.refused': {
    animation: '[hint-refused {durations.slower} {easings.out}]',
    _motionReduce: { animation: '[hint-refused-flash {durations.slower} {easings.out}]' },
  },
});

/** What an item in hand would change where it is about to go. */
const effectList = css({
  listStyle: 'none',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '4',
  m: '0',
  mt: '6',
  mb: '1',
  p: '0',
});

/** One change, in a white frame: green for the better, red for the worse. */
const effect = css({
  fontSize: '13',
  fontWeight: 'medium',
  border: '[{borderWidths.fine} solid {colors.border.strong}]',
  bg: 'bg.card',
  borderRadius: '8',
  py: '1',
  px: '8',
  '&.good': { bg: 'good.bg', borderColor: 'good.solid', color: 'good' },
  '&.bad': { bg: 'bad.bg', borderColor: 'bad.solid', color: 'bad' },
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
