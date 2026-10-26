// The year-end awards ceremony.

import { certificatesLeft } from '../../../core/certificates';
import { AWARD_REP, AWARDS } from '../../../core/data';
import { money } from '../../../core/format';
import { css } from '../../../styled-system/css';
import { buttonRow, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { Dialog } from './Dialog';

/**
 * Every award, each a card with its trophy, its name and how the center did, and the prize or Missed to the right: gold
 * for one won, and faded, its trophy greyed, for one missed. `awards` is for the end-to-end tests to find it by.
 */
const awards = css({
  listStyle: 'none',
  p: '0',
  my: '10',
  mx: '0',
  display: 'grid',
  gridTemplateColumns: '[repeat(auto-fit, minmax(260px, 1fr))]',
  gap: '6',
  textAlign: 'left',
  '& li': {
    display: 'grid',
    gridTemplateColumns: '[30px 1fr auto]',
    alignItems: 'center',
    gap: '8',
    border: 'divider',
    borderRadius: '10',
    py: '4',
    px: '8',
    bg: 'bg.card',
  },
  '& li.won': { borderColor: 'highlight', bg: 'highlight.bg' },
  '& li.missed': { opacity: '[0.75]' },
  '& li.missed .icon': { filter: '[grayscale(1)]', opacity: '[0.45]' },
  '& small': { display: 'block', fontSize: '12', lineHeight: '[1.25]' },
  '& em': { fontStyle: 'normal', fontWeight: 'bold', fontSize: '13' },
});

/** Every award at the year's ceremony, won or missed, with how the center did and what the winners took home. */
export function AwardsDialog() {
  const hud = useHud();
  const { sim, tools } = useGame();
  const ceremony = sim.s.ceremony;
  if (!ceremony) return null;
  const won = ceremony.results.filter((r) => r.won);
  const prizes = won.reduce((sum, r) => sum + AWARDS[r.award].prize, 0);
  return (
    <Dialog wide>
      <h2>
        <IconText id="ui-trophy">{`Year ${ceremony.year} awards`}</IconText>
      </h2>
      <p>
        {won.length
          ? `${won.length} of ${ceremony.results.length} won: ${money(prizes)} in prizes, and +${won.length * AWARD_REP}% reputation.`
          : 'Nothing this year. The judges will be back next year, and the bar only goes up.'}
      </p>
      <ul class={cx('awards', awards)}>
        {ceremony.results.map((r) => {
          const def = AWARDS[r.award];
          return (
            <li key={r.award} class={cx(r.won ? 'won' : 'missed')}>
              <Icon id={def.icon} size={28} />
              <span>
                <b>{def.name}</b>
                <small>{`${def.desc}. ${r.note}.`}</small>
              </span>
              <em>{r.won ? money(def.prize) : 'Missed'}</em>
            </li>
          );
        })}
      </ul>
      <p class="sub">
        Trophies won go in a Trophy Cabinet, and are listed under Awards in the Stats menu. Each one earns a Certificate
        of Excellence to hang on a wall, from here or the Items menu.
      </p>
      <div class={buttonRow()}>
        {certificatesLeft(sim.s).length > 0 && (
          <Button
            onPress={() => {
              hud.close();
              tools.startItem('certificate');
            }}
          >
            <IconText id="item-certificate">Hang a certificate</IconText>
          </Button>
        )}
        <Button
          class={goButton()}
          onPress={() => {
            hud.close();
          }}
        >
          Back to work
        </Button>
      </div>
    </Dialog>
  );
}
