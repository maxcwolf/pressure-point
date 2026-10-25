// Top center: announcements over the speakers, a line at a time.

import { css } from '../../styled-system/css';
import { useHud } from '../hooks/use-hud';
import { IconText } from './common/Icon';

/** Top center, kept to under half the window's width. */
const column = css({
  top: '[14px]',
  left: '[50%]',
  transform: '[translateX(-50%)]',
  maxW: '[calc(var(--vw) * 0.46)]',
});

/** An announcement: a navy pill with cream words, dropping in. */
const pill = css({
  bg: 'navy',
  color: 'cream',
  py: '8',
  px: '16',
  borderRadius: 'pill',
  fontSize: '15',
  boxShadow: '[0 4px 0 rgba(0, 0, 0, 0.2)]',
  animation: 'drop 0.35s ease-out',
  textAlign: 'center',
  // an icon keeps its navy outline on the navy pill by sitting on a cream chip
  '& .icon': { bg: 'cream', borderRadius: '6', p: '[1.5px]' },
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
