// Top center: announcements over the speakers, a line at a time.

import { css } from '../../styled-system/css';
import { useHud } from '../hooks/use-hud';
import { IconText } from './common/Icon';

/** Top center, kept to under half the window's width. */
const column = css({
  top: 'gutter',
  left: 'half',
  transform: '[translateX(-50%)]',
  maxW: '[calc(var(--vw) * 0.46)]',
});

/** An announcement: a navy pill with cream words, dropping in. */
const pill = css({
  bg: 'bg.inverse',
  color: 'fg.inverse',
  py: '8',
  px: '16',
  borderRadius: 'pill',
  fontSize: '15',
  boxShadow: 'raised.dark',
  animation: '[drop {durations.slow} {easings.out}]',
  textAlign: 'center',
  // an icon keeps its navy outline on the navy pill by sitting on a cream chip
  '& .icon': { bg: 'bg.panel', borderRadius: '6', p: '[1.5px]' },
});

/** The current announcement, if there is one, each new line coming in as itself. */
export function Announcement() {
  const { shown } = useHud().announcer;
  return (
    <div id="announce" class={column}>
      {shown && (
        <div key={shown.id} class={pill}>
          <IconText id="ui-marketing">{shown.text}</IconText>
        </div>
      )}
    </div>
  );
}
