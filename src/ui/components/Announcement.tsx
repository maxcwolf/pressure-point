// Top center: announcements over the speakers, a line at a time.

import './Announcement.css';

import { useHud } from '../hooks/use-hud';
import { IconText } from './common/Icon';

/** The current announcement, if there is one, each new line coming in as itself. */
export function Announcement() {
  const { shown } = useHud().announcer;
  return (
    <div id="announce">
      {shown && (
        <div key={shown.id} class="announce">
          <IconText id="ui-marketing">{shown.text}</IconText>
        </div>
      )}
    </div>
  );
}
