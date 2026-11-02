// The profiles on this computer, on the title screen: who is playing, and a way to switch to, add, rename or delete one.

import { useEffect, useRef, useState } from 'preact/hooks';

import {
  addProfile,
  currentProfile,
  deleteProfile,
  loadProfiles,
  MAX_NAME,
  MAX_PROFILES,
  nextName,
  type Profile,
  renameProfile,
  switchProfile,
} from '../../storage/profiles';
import { css } from '../../styled-system/css';
import { dangerButton, goButton } from '../../styled-system/recipes';
import { cx } from '../lib/cx';
import { contentsOf, deleteWarning, profileFacts, refusalNote } from '../lib/profiles';
import { Icon } from './common/Icon';

export interface ProfilesPanelProps {
  /** Reload the page, so everything is read again for the profile just switched to. */
  reload: () => void;
}

/** The panel: the profiles, then a box to add one. */
const panel = css({ textAlign: 'left', m: '0', mt: '4', mb: '4' });

/** What a profile is, over the list. */
const intro = css({ fontSize: '13', opacity: 'soft', m: '0', mb: '10', textAlign: 'center' });

/** The profiles, one under another; the panel scrolls once there are more than fit. */
const list = css({
  listStyle: 'none',
  p: '0',
  m: '0',
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
});

/** A profile: its icon and name, with its buttons at the right; the one playing edged in teal. */
const row = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '10',
  bg: 'bg.card',
  border: 'card',
  borderRadius: '12',
  py: '6',
  px: '10',
  '&.current': { borderColor: 'accent', boxShadow: 'ring' },
});

/** A profile's name over what it has. */
const about = css({ flex: '1', minW: '0' });
const aboutName = css({
  display: 'block',
  fontWeight: 'bold',
  fontSize: '15',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const aboutFacts = css({ fontSize: '12', opacity: 'muted' });

/** A profile's buttons. */
const actions = css({ display: 'flex', gap: '4', flex: 'none', alignItems: 'center' });

/** A button on the panel: green to play or add, red to delete, and cream for the rest. */
const button = css.raw({
  border: 'outline.thin',
  borderRadius: '10',
  py: '2',
  px: '10',
  fontSize: '13',
  fontWeight: 'bold',
  bg: 'control',
  m: '0',
  boxShadow: 'pressed',
  '&.go': { bg: 'go', color: 'fg.on-accent' },
  '&.danger': { bg: 'bad.bg', color: 'bad' },
});
const rowButton = css(button);

/** Says which profile is being played, where the others have Play. */
const playing = css({
  fontSize: '12',
  fontWeight: 'heavy',
  color: 'accent',
  textTransform: 'uppercase',
  letterSpacing: 'wide',
  px: '6',
});

/** A box for a profile's name, in a row or for a new one. */
const nameBox = css({
  flex: '1',
  minW: '0',
  font: 'inherit',
  fontSize: '15',
  color: 'fg',
  bg: 'bg.card',
  border: 'outline',
  borderRadius: '12',
  py: '6',
  px: '12',
  userSelect: 'text',
  WebkitUserSelect: 'text',
});

/** The name box and its buttons, in place of a profile's name while it is renamed, or under the list for a new one. */
const nameRow = css({ display: 'flex', gap: '8', flex: '1', minW: '0', alignItems: 'center' });

/** The box to add a profile in, under the list. */
const addRow = css({ display: 'flex', gap: '8', mt: '10' });

/** Add, as big as the box beside it. */
const addButton = css(button, { fontSize: '15', py: '6', px: '16' });

/** The question before a profile is deleted, across the bottom of its row. */
const asking = css({
  flexBasis: 'full',
  bg: 'bad.bg',
  borderRadius: '10',
  py: '8',
  px: '10',
  '& p': { fontSize: '13', m: '0', mb: '6', lineHeight: 'snug' },
});
const askingTitle = css({ fontWeight: 'bold', color: 'bad' });

/** Why a name would not do, in red. */
const noteLook = css({
  fontSize: '14',
  bg: 'bad.bg',
  color: 'bad',
  borderRadius: '10',
  py: '4',
  px: '10',
  mt: '8',
  mb: '0',
});

/** The profiles, with the one playing marked, and ways to switch to, add, rename and delete them. */
export function ProfilesPanel({ reload }: ProfilesPanelProps) {
  const [profiles, setProfiles] = useState(() => loadProfiles().profiles);
  const playingId = currentProfile();
  /** The profile being renamed, and the name typed so far. */
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  /** The profile whose Delete has been pressed, waiting for the player to say they mean it. */
  const [deleting, setDeleting] = useState('');
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const renameBox = useRef<HTMLInputElement>(null);
  const renamingId = renaming?.id;
  // the name is ready to type over as Rename is pressed
  useEffect(() => {
    renameBox.current?.select();
  }, [renamingId]);
  /** Read the profiles again after changing them. */
  const reread = () => {
    setProfiles(loadProfiles().profiles);
  };
  /** Play as a profile: switch to it and reload, so its saves and settings are read. */
  const play = (id: string) => {
    if (switchProfile(id)) reload();
  };
  /** Add a profile under the name typed, or the next "Player N", and play as it. */
  const add = () => {
    const name = draft.trim() || nextName();
    const made = addProfile(name);
    if (typeof made === 'string') setNote(refusalNote(made, name));
    else play(made.id);
  };
  /** Give the profile being renamed the name typed. */
  const rename = () => {
    if (!renaming) return;
    const done = renameProfile(renaming.id, renaming.name);
    if (typeof done === 'string') {
      setNote(refusalNote(done, renaming.name.trim()));
      return;
    }
    setRenaming(null);
    setNote('');
    reread();
  };
  /** Delete a profile, once the player has said they mean it; deleting the one playing moves to the next. */
  const remove = (p: Profile) => {
    if (!deleteProfile(p.id)) return;
    setDeleting('');
    if (p.id === playingId) reload();
    else reread();
  };
  /** Keys typed into a name box go to it, not to the title screen, which goes back from a panel on Esc. */
  const typing = (e: KeyboardEvent, enter: () => void, escape: () => void) => {
    e.stopPropagation();
    if (e.key === 'Enter') enter();
    if (e.key === 'Escape') escape();
  };

  // `profiles`, `profile-list`, `profile-row`, `current`, `profile-note` and `deleting` are for the tests
  return (
    <div class={cx('profiles', panel)}>
      <p class={intro}>Each profile has saved games, a campaign and settings of its own.</p>
      <ul class={cx('profile-list', list)}>
        {profiles.map((p) => {
          const contents = contentsOf(p.id);
          const current = p.id === playingId;
          return (
            <li key={p.id} class={cx('profile-row', row, current && 'current')} data-id={p.id}>
              <Icon id="ui-guests" size={28} />
              {renaming?.id === p.id ? (
                <div class={nameRow}>
                  <input
                    class={nameBox}
                    type="text"
                    maxLength={MAX_NAME}
                    value={renaming.name}
                    aria-label={`New name for ${p.name}`}
                    ref={renameBox}
                    onInput={(e) => {
                      setRenaming({ id: p.id, name: e.currentTarget.value });
                    }}
                    onKeyDown={(e) => {
                      typing(e, rename, () => {
                        setRenaming(null);
                      });
                    }}
                  />
                  <button class={cx(goButton(), rowButton)} onClick={rename}>
                    Save
                  </button>
                  <button
                    class={rowButton}
                    onClick={() => {
                      setRenaming(null);
                      setNote('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div class={about}>
                    <b class={aboutName}>{p.name}</b> <span class={aboutFacts}>{profileFacts(contents)}</span>
                  </div>{' '}
                  <div class={actions}>
                    {current ? (
                      <span class={playing}>Playing</span>
                    ) : (
                      <button
                        class={cx(goButton(), rowButton)}
                        onClick={() => {
                          play(p.id);
                        }}
                      >
                        Play
                      </button>
                    )}
                    <button
                      class={rowButton}
                      onClick={() => {
                        setDeleting('');
                        setNote('');
                        setRenaming({ id: p.id, name: p.name });
                      }}
                    >
                      Rename
                    </button>
                    {profiles.length > 1 && (
                      <button
                        class={cx(dangerButton(), rowButton)}
                        onClick={() => {
                          setRenaming(null);
                          setDeleting(p.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
              {deleting === p.id && (
                <div class={cx('deleting', asking)} role="alertdialog" aria-label={`Delete ${p.name}?`}>
                  <p class={askingTitle}>{`Delete ${p.name}?`}</p>
                  <p>{deleteWarning(contents)}</p>
                  {current && <p>{`The game moves to ${profiles.find((q) => q.id !== p.id)?.name ?? ''}.`}</p>}
                  <div class={actions}>
                    <button
                      class={cx(dangerButton(), rowButton)}
                      onClick={() => {
                        remove(p);
                      }}
                    >
                      {`Delete ${p.name}`}
                    </button>
                    <button
                      class={cx(goButton(), rowButton)}
                      onClick={() => {
                        setDeleting('');
                      }}
                    >
                      {`Keep ${p.name}`}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {profiles.length < MAX_PROFILES ? (
        <div class={addRow}>
          <input
            class={nameBox}
            type="text"
            maxLength={MAX_NAME}
            value={draft}
            placeholder={nextName()}
            aria-label="Name for a new profile"
            onInput={(e) => {
              setDraft(e.currentTarget.value);
            }}
            onKeyDown={(e) => {
              typing(e, add, () => {
                setDraft('');
              });
            }}
          />
          <button class={cx(goButton(), addButton)} onClick={add}>
            Add profile
          </button>
        </div>
      ) : (
        <p class={intro}>{`There is room for ${MAX_PROFILES} profiles. Delete one to add another.`}</p>
      )}
      {note && (
        <p class={cx('profile-note', noteLook)} role="alert">
          {note}
        </p>
      )}
    </div>
  );
}
