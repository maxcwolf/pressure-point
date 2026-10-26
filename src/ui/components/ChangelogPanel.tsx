// The title screen's What's New panel: every version's notes from the changelog, newest first, with the one being
// played marked.

import changelog from '../../../CHANGELOG.md?raw';
import { css } from '../../styled-system/css';
import { parseChangelog, releaseName, type Span } from '../lib/changelog';

const RELEASES = parseChangelog(changelog);

/** Every version's notes, one after another, each a list with its own lists under some of its lines. */
const changelogLook = css({
  textAlign: 'left',
  fontSize: '15',
  lineHeight: 'normal',
  '& section + section': { mt: '14' },
  '& ul': { pl: '16' },
  '& li + li': { mt: '4' },
  '& li ul': { mt: '4' },
});

/** A version's name, with This version beside the one being played. */
const versionName = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8',
  fontSize: '17',
  fontWeight: 'bold',
  color: 'fg.accent',
  mb: '4',
});

/** This version, on a teal chip. */
const here = css({
  fontSize: '12',
  fontWeight: 'bold',
  color: 'fg.on-accent',
  bg: 'accent',
  borderRadius: '8',
  py: '[1px]',
  px: '6',
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
