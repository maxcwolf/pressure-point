// The news that an ailment is going around, a week before its guests come.

import { conditionOf, DAYS_PER_MONTH, DISCIPLINES, ITEMS, MODALITIES, ROLES, ROOMS, WAVES } from '../../../core/data';
import { an } from '../../../core/format';
import { wavePerWeek } from '../../../core/sim/waves';
import { css } from '../../../styled-system/css';
import { buttonRow, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { dateSpan } from '../../lib/seasons';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { Dialog } from './Dialog';

/** "Going around town", in small teal capitals over the ailment's name. */
const headline = css({
  fontSize: '12',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 'wider',
  color: 'fg.accent',
  m: '0',
});

/** A card in the dialog: when its guests come, on a warm ground, or what it opens, on the lilac of a star's unlocks. */
const card = css({
  borderRadius: '12',
  py: '8',
  px: '12',
  mt: '10',
  fontSize: '14 !important',
  border: '[{borderWidths.thin} solid {colors.warm.solid}]',
  bg: 'warm.bg',
  '&.opens': { bg: 'special.bg', borderColor: 'special.solid' },
});

/** The ailment going around: why, when its guests come, what it opens, and what happens if the center is not ready. */
export function WaveDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const s = sim.s;
  const w = s.wave ?? s.pastWaves[s.pastWaves.length - 1];
  if (!w) return null;
  const c = conditionOf(w.condition);
  const m = MODALITIES[c.modality];
  const disc = DISCIPLINES[m.discipline];
  const role = ROLES[disc.role].name;
  const kit = m.equipment ? ITEMS[m.equipment].name : '';
  const cause = WAVES[s.center]?.condition === w.condition ? WAVES[s.center]?.cause : '';
  // the size of the wave in guests a week, from the usual pace now: something a player can weigh against their staff
  const perWeek = wavePerWeek(sim.arrivalPace().tables);
  // under one a week, as in a center still small, it is said a month, so a quiet wave does not sound like more
  const size =
    perWeek >= 1
      ? `${Math.round(perWeek)} a week`
      : `${Math.max(1, Math.round((perWeek * DAYS_PER_MONTH) / 7))} a month`;
  return (
    <Dialog>
      <p class={headline}>Going around town</p>
      <h2>
        <IconText id="bubble-sick">{c.name}</IconText>
      </h2>
      <p>
        <i>{`“${c.desc}”`}</i>
        {cause && ` ${cause}`}
      </p>
      <p class={card}>
        <b>{`${dateSpan(w.starts, w.ends, s.startMonth)}:`}</b>
        {` guests with ${c.name} come on top of the usual ones, about ${size} at today’s pace, all for ${m.name}.`}
      </p>
      <p class={`${card} opens`}>
        <b>{w.opened ? `New treatment, ahead of star ${m.star}:` : 'Treated with:'}</b>
        {` ${m.name}, in the ${ROOMS[disc.room].name}. Train ${an(role)} in a Training Room`}
        {kit ? `; the ${kit} is in the Items menu.` : '.'}
        {m.rest &&
          !sim.hasRoom('recovery') &&
          ' Its guests need a rest after, so they come in only once there is a Recovery Lounge too.'}
      </p>
      <p class="sub">
        Not ready? They turn back at the door and come another time, at no cost. Ready, they come in like any guest, so
        keep the line short.
      </p>
      <div class={buttonRow()}>
        <Button
          quiet
          onPress={() => {
            hud.close();
            if (hud.menu !== 'treatments') hud.toggleMenu('treatments');
          }}
        >
          Treatments menu
        </Button>
        <Button
          class={goButton()}
          onPress={() => {
            hud.close();
          }}
        >
          Got it
        </Button>
      </div>
    </Dialog>
  );
}
