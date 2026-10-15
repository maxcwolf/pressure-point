// The title screen's What's New panel: every version's notes from the changelog, newest first, with the one being
// played marked.

import './ChangelogPanel.css';

import changelog from '../../../CHANGELOG.md?raw';
import { parseChangelog, releaseName, type Span } from '../lib/changelog';

const RELEASES = parseChangelog(changelog);

/** A line of a note, with its bold runs in bold. */
function Line({ spans }: { spans: readonly Span[] }) {
  return <>{spans.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : s.text))}</>;
}

/** Every version's notes, newest first. */
export function ChangelogPanel() {
  const playing = `v${__APP_VERSION__}`;
  return (
    <div class="changelog">
      {RELEASES.map((r) => (
        <section key={r.version}>
          <h3>
            {releaseName(r.version)}
            {r.version === playing && <span class="changelog-here">This version</span>}
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
