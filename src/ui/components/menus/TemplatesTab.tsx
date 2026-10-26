// The Rooms menu's templates: rooms saved with their furniture, to build again in any game, export or import.

import { useState } from 'preact/hooks';

import { decorOpen } from '../../../core/campaign';
import { type DecorKey, ROOMS } from '../../../core/data';
import { money } from '../../../core/format';
import { copyCost } from '../../../core/room-layout';
import { unlockedUpTo } from '../../../core/state/game';
import {
  describeLayout,
  MAX_NAME,
  MAX_TEMPLATES,
  mergeTemplates,
  openDecor,
  readTemplatesFile,
  renameTemplate,
  type Template,
  templateFilename,
  templateLock,
  templatesFile,
} from '../../../core/templates';
import { loadCampaign } from '../../../storage/campaign';
import { css } from '../../../styled-system/css';
import { fileButton, tabButton } from '../../../styled-system/recipes';
import { download } from '../../dom';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { sorted, TEMPLATE_SORTS } from '../../lib/sorts';
import { keepTemplates } from '../../templates';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { cardLook, cardsLook } from './looks';

/** The templates' cards, wide enough for their buttons. */
const templateCards = css(cardsLook, { gridTemplateColumns: '[repeat(auto-fill, minmax(214px, 1fr))]' });

/** A template's card, which stays as bright when its room cannot be afforded, for its own buttons to say so. */
const templateCard = css(cardLook, { gap: '4', '&.poor': { opacity: '[1]', cursor: 'auto' } });

/** The template's name, which can be changed in place: plain words on the card until the pointer or the typing is on it. */
const nameInput = css({
  font: 'inherit',
  fontSize: '15',
  fontWeight: 'bold',
  color: 'fg',
  border: '[{borderWidths.thin} solid transparent]',
  borderRadius: '8',
  py: '[1px]',
  px: '4',
  my: '0',
  mx: '[-6px]',
  w: '[calc(100% + 8px)]',
  bg: '[transparent]',
  '&:is(:hover, :focus)': { borderColor: 'accent', bg: 'bg.hover', outline: 'none' },
});

/**
 * A template's buttons, along the bottom, level with the cards beside it: Build in green, Delete in red at the far end,
 * and Export lighter under the pointer.
 */
const actions = css({
  display: 'flex',
  gap: '4',
  mt: 'auto',
  pt: '4',
  '& button': {
    border: 'outline.thin',
    borderRadius: '8',
    py: '2',
    px: '8',
    fontSize: '13',
    fontWeight: 'bold',
    bg: 'bg.card',
  },
  '& button:not(.build, .delete):hover': { bg: 'bg.hover' },
  '& button.build': { bg: 'go', color: 'fg.on-accent' },
  '& button.delete': { ml: 'auto', bg: 'bad.bg', color: 'bad' },
  '& button.locked': { opacity: '[0.5]', cursor: 'not-allowed' },
});

/** The way to import more and export them all, with how many there are of how many there can be at the far end. */
const foot = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8',
  flexWrap: 'wrap',
  mt: '10',
  // the count at the far end: `span.sub`, or the menu's own margins for smaller words would win
  '& span.sub': { m: '0', ml: '[auto]', fontSize: '13', opacity: '[0.75]' },
});

/** A template: its name, which can be changed, its room, size and cost, and buttons to build, export or delete it. */
function TemplateCard({ t, lock, open }: { t: Template; lock: string; open: (key: DecorKey) => boolean }) {
  const hud = useHud();
  const { sim, tools } = useGame();
  const { layout } = t;
  const room = ROOMS[layout.type];
  const cost = copyCost(layout);
  // the name as it is being typed: kept here, or the interface redrawing as the game runs would put the old one back
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div class={cx('card', 'template', templateCard, !lock && sim.s.money < cost && 'poor')} data-template={t.name}>
      <Icon id={room.icon} size={34} />
      <span class="cost">{money(cost)}</span>
      <input
        class={nameInput}
        aria-label="Template name"
        value={draft ?? t.name}
        maxLength={MAX_NAME}
        onInput={(e) => {
          setDraft(e.currentTarget.value);
        }}
        onChange={(e) => {
          keepTemplates(hud, renameTemplate(hud.templates, t.id, e.currentTarget.value));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <p>{describeLayout(layout)}</p>
      {lock && (
        <em>
          <IconText id="ui-lock">{lock}</IconText>
        </em>
      )}
      <div class={actions}>
        <Button
          class="build"
          title={lock || `Build rooms like this wherever you click, for ${money(cost)} each. R turns them.`}
          locked={!!lock || sim.s.money < cost}
          onPress={() => {
            hud.menu = null;
            // a floor or walls not unlocked in this game are left standard
            tools.startTemplate(t.name, openDecor(layout, open));
          }}
        >
          Build
        </Button>
        <Button
          title="Save this template as a file, to keep or to share"
          onPress={() => {
            download(templateFilename(t.name), templatesFile([t]));
          }}
        >
          Export
        </Button>
        <Button
          class="delete"
          onPress={() => {
            keepTemplates(
              hud,
              hud.templates.filter((o) => o.id !== t.id),
            );
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

/** Every template saved, in the order picked, with a way to import more from a file and to export them all. */
export function TemplatesTab() {
  const hud = useHud();
  const { sim } = useGame();
  const campaign = loadCampaign();
  const allowed = {
    upTo: unlockedUpTo(sim.s),
    unlocked: campaign.unlocked,
    enabled: sim.enabled.bind(sim),
    center: sim.s.center,
  };
  /** Whether a floor or wall can be used in this game. */
  const open = (key: DecorKey) => decorOpen(key, allowed.upTo, campaign.decor);
  /** Add the templates in a file the player picked. */
  const importFrom = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    // empty the input, or picking the same file again would not count as a change and nothing would happen
    input.value = '';
    if (!file) return;
    void file.text().then((text) => {
      const found = readTemplatesFile(text);
      if (!found?.length) {
        hud.toast(`"${file.name}" holds no room templates.`, 'bad');
        return;
      }
      const merged = mergeTemplates(hud.templates, found);
      const added = merged.length - hud.templates.length;
      if (!added) hud.toast(`There is room for ${MAX_TEMPLATES} templates. Delete some first.`, 'bad');
      else if (keepTemplates(hud, merged))
        hud.toast(`Imported ${added === 1 ? 'a template' : `${added} templates`} from "${file.name}".`, 'good');
    });
  };
  return (
    <>
      {hud.templates.length ? (
        <div class={templateCards}>
          {sorted(hud.templates, TEMPLATE_SORTS, hud.sorts.templates).map((t) => (
            <TemplateCard key={t.id} t={t} lock={templateLock(t.layout, allowed)} open={open} />
          ))}
        </div>
      ) : (
        <p class="sub">
          No templates yet. Select a built room and press Save as template to keep it, furniture, windows and all, then
          build it again from here, in this game or any other.
        </p>
      )}
      <div class={foot}>
        <label class={fileButton()}>
          Import a template file
          <input
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              importFrom(e.currentTarget);
            }}
          />
        </label>
        {hud.templates.length > 1 && (
          <Button
            class={tabButton({ size: 'small' })}
            onPress={() => {
              download(templateFilename(), templatesFile(hud.templates));
            }}
          >
            Export all
          </Button>
        )}
        <span class="sub">{`${hud.templates.length} of ${MAX_TEMPLATES} templates`}</span>
      </div>
    </>
  );
}
