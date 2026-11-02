// The town paper's latest issue on one page: the masthead, the lead with its story, the "Also", two letters to the
// editor, the center's column and one classified. Shown in its dialog and under the Stats menu's Paper tab.

import type { Paper } from '../../core/state/types';
import { css } from '../../styled-system/css';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { storyParts } from '../lib/paper';
import { Button } from './common/Button';

/** The page: words left to right like a paper's, on white. `paper` is for the end-to-end tests to find it by. */
const page = css({
  textAlign: 'left',
  bg: 'bg.card',
  border: 'card',
  borderRadius: '8',
  py: '14',
  px: '20',
  '& p': { fontSize: '14', lineHeight: 'snug' },
});

/** The masthead: the paper's name across the top in a newspaper's serif, its motto and the issue under it. */
const masthead = css({
  textAlign: 'center',
  pb: '8',
  borderBottom: '[{borderWidths.thick} double {colors.outline}]',
  '& h2': { fontFamily: 'paper', fontSize: 'display', fontWeight: 'heavy', lineHeight: 'tight', mb: '2' },
  '& p': { fontSize: '13', color: 'fg.muted' },
  '& p em': { fontStyle: 'italic' },
});

/** The lead: its headline in the serif's capitals, its story, and the "Also" under a rule. */
const front = css({
  py: '10',
  borderBottom: 'divider',
  '& h3': { fontFamily: 'paper', fontSize: '20', fontWeight: 'heavy', lineHeight: 'tight', mb: '6' },
  '& p.also': { mt: '8', pt: '6', borderTop: 'hairline', fontSize: '13' },
  '& p.also b': { fontWeight: 'bold' },
});

/** A name in the story to click: whoever or whatever it names, while they are still there. */
const nameLink = css({
  display: 'inline',
  p: '0',
  border: 'none',
  bg: '[none]',
  font: 'inherit',
  color: 'fg.accent',
  fontWeight: 'bold',
  textDecoration: 'underline',
  pointerEvents: 'auto',
  _hover: { color: 'fg' },
});

/** The letters beside the column and the classified. */
const columns = css({
  display: 'grid',
  gridTemplateColumns: '[3fr 2fr]',
  gap: '16',
  pt: '10',
  '& h4': { fontFamily: 'paper', fontSize: '15', fontWeight: 'heavy', mb: '4' },
  '& blockquote': { m: '0', mb: '8' },
  '& blockquote p': { fontStyle: 'italic' },
  '& blockquote footer': { fontSize: '12', color: 'fg.muted' },
  '& .side > div + div': { mt: '10', pt: '8', borderTop: 'hairline' },
  _max700: { gridTemplateColumns: '[1fr]' },
});

/** One issue of the town paper, its names a click to whoever they name, which closes `onLeave` first if given. */
export function PaperPage({ paper, onLeave }: { paper: Paper; onLeave?: () => void }) {
  const hud = useHud();
  const { sim } = useGame();
  const parts = storyParts(paper.lead.story, paper.links, (l) => sim.whereIs(l) !== null);
  return (
    <article class={cx('paper', page)}>
      <header class={masthead}>
        <h2>{paper.name}</h2>
        <p>
          <em>{paper.motto}</em>
          {` · Issue ${paper.issue}`}
        </p>
      </header>
      <section class={cx('front', front)}>
        <h3>{paper.lead.headline}</h3>
        <p>
          {parts.map((part, i) => {
            const link = part.link;
            if (!link) return <span key={i}>{part.text}</span>;
            return (
              <Button
                key={i}
                class={nameLink}
                title="Show me"
                onPress={() => {
                  onLeave?.();
                  hud.show({ kind: link.kind, id: link.id });
                }}
              >
                {part.text}
              </Button>
            );
          })}
        </p>
        {paper.also && (
          <p class="also">
            <b>Also: </b>
            {paper.also}
          </p>
        )}
      </section>
      <div class={columns}>
        <section class="letters">
          <h4>Letters to the editor</h4>
          {paper.letters.length ? (
            paper.letters.map((l, i) => (
              <blockquote key={i}>
                <p>{`“${l.text}”`}</p>
                <footer>{l.sign}</footer>
              </blockquote>
            ))
          ) : (
            <p>No letters this quarter. The editor checked twice.</p>
          )}
        </section>
        <div class="side">
          <div class="column">
            <h4>{paper.column.title}</h4>
            <p>{paper.column.text}</p>
          </div>
          <div class="classified">
            <h4>Classified</h4>
            <p>{paper.classified}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
