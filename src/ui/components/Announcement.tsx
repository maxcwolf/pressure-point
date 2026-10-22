// Top center: announcements over the speakers.

import './Announcement.css';

import { useHud } from '../hooks/use-hud';
import { IconText } from './common/Icon';

/** The current announcement, if there is one. */
export function Announcement() {
  const { announcement } = useHud();
  return (
    <div id="announce">
      {announcement && (
        <div class="announce">
          <IconText id="ui-marketing">{announcement}</IconText>
        </div>
      )}
    </div>
  );
}
