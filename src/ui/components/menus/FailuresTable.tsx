// The latest failed treatments, technique by technique: how many, why, and what helps.

import { MODALITIES, modalityLabel } from '../../../core/data';
import { css } from '../../../styled-system/css';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { causeText, failureBreakdown } from '../../lib/failures';
import { IconText } from '../common/Icon';
import { tableLook } from './looks';

/** The breakdown, its causes and fix in words rather than figures, so left-aligned. */
const failuresLook = css(tableLook, {
  mt: '6',
  '& :is(th, td):is(:nth-child(3), :nth-child(4))': { textAlign: 'left' },
  '& td:nth-child(3)': { color: 'bad' },
});

/** The breakdown's heading, set apart from the table of conditions above it. */
const heading = css({ mt: '12' });

/** A row for each technique among the latest failed treatments, the one that failed most first. */
export function FailuresTable() {
  const { sim } = useGame();
  const failures = sim.s.failures ?? [];
  const rows = failureBreakdown(failures);
  return (
    <>
      <h4 class={heading}>Why treatments failed lately</h4>
      {rows.length ? (
        <>
          <p class="sub">{`The latest ${failures.length === 1 ? 'treatment' : `${failures.length} treatments`} to fail, by technique, with what took off their chance of working.`}</p>
          {/* `failures` is for the end-to-end tests */}
          <table class={cx('failures', failuresLook)}>
            <thead>
              <tr>
                <th>Treatment</th>
                <th>Failed</th>
                <th>Main causes</th>
                <th>What helps</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.modality}>
                  <td>
                    <IconText id={MODALITIES[r.modality].icon}>{modalityLabel(r.modality)}</IconText>
                  </td>
                  <td>{r.count}</td>
                  <td>{r.causes.slice(0, 3).map(causeText).join(' · ')}</td>
                  <td>{r.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p class="sub">
          {sim.s.stats.failed
            ? 'Treatments that fail from now on are broken down here, with why.'
            : 'No treatment has failed yet. When one does, why is broken down here.'}
        </p>
      )}
    </>
  );
}
