// The title screen's What's New panel: every version's notes from the changelog, newest first, with the one being
// played marked.

import changelog from '../../../CHANGELOG.md?raw';
import { css } from '../../styled-system/css';
import { parseChangelog, releaseName, type Span } from '../lib/changelog';

const RELEASES = parseChangelog(changelog);

/** Every version's notes, one after another, each a list with its own lists under some of its lines. */
const changelogLook = css({
  textAlign: 'left',
  fontSize: '[14.5px]',
  lineHeight: '[1.4]',
  '& section + section': { mt: '[14px]' },
  '& ul': { pl: '[18px]' },
  '& li + li': { mt: 'xs' },
  '& li ul': { mt: 'xs' },
});

/** A version's name, with This version beside the one being played. */
const versionName = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'm',
  fontSize: '[17px]',
  fontWeight: 'bold',
  color: 'teal-dark',
  mb: 'xs',
});

/** This version, on a teal chip. */
const here = css({
  fontSize: '[11.5px]',
  fontWeight: 'bold',
  color: 'white',
  bg: 'teal',
  borderRadius: '[8px]',
  p: '[1px 7px]',
});

/** A bold run in a note. */
const bold = css({ fontWeight: 'bold' });

/** A line of a note, with its bold runs in bold. */
function Line({ spans }: { spans: readonly Span[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.bold ? (
          <strong key={i} class={bold}>
            {s.text}
          </strong>
        ) : (
          s.text
        ),
      )}
    </>
  );
}

/** Every version's notes, newest first. */
export function ChangelogPanel() {
  const playing = `v${__APP_VERSION__}`;
  return (
    <div class={changelogLook}>
      {RELEASES.map((r) => (
        <section key={r.version}>
          <h3 class={versionName}>
            {releaseName(r.version)}
            {r.version === playing && <span class={here}>This version</span>}
          </h3>
          <ul>
            {r.notes.map((n, i) => (
              <li key={i}>
                <Line spans={n.spans} />
                {n.sub.length > 0 && (
                  <ul>
                    {n.sub.map((s, j) => (
                      <li key={j}>
                        <Line spans={s} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
