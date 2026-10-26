// The Policy menu: how sure a diagnosis must be, who goes first, and when staff take breaks.

import type { ComponentChildren } from 'preact';

import {
  BREAK_AT_MAX,
  BREAK_AT_MIN,
  DIAGNOSIS_MAX,
  DIAGNOSIS_MIN,
  type IconId,
  ROLE_ORDER,
  ROLES,
} from '../../../core/data';
import { css } from '../../../styled-system/css';
import { Box } from '../../../styled-system/jsx';
import { panelCard } from '../../../styled-system/recipes';
import { useGame } from '../../hooks/use-hud';
import { percent } from '../../lib/chance';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { menuPanel } from './looks';

/** The most of one role a break limit can be set to; above it, the limit is off. */
const MAX_BREAK_LIMIT = 5;

/** A small square button, such as a stepper's − and +, or a wider one with words and a little room each side. */
const control = css({
  border: 'outline.thin',
  borderRadius: '8',
  bg: 'control',
  fontWeight: 'bold',
  h: 'control',
  _locked: { opacity: 'locked' },
});

/** A switch with words on it, gold while it is on. */
const toggle = css({ px: '12', py: '0', _on: { bg: 'toggle.on' } });

/** A setting with a value and a pair of buttons to step it down and up, its name above them or, inline, beside them. */
function Stepper(props: {
  name: string;
  /** An icon before the name. */
  icon?: IconId;
  value: string;
  atMin: boolean;
  atMax: boolean;
  inline?: boolean;
  onStep: (by: number) => void;
}) {
  return (
    // `stepper` is for the end-to-end tests to find it by
    <Box
      className="stepper"
      display="grid"
      gridTemplateColumns={props.inline ? '[1fr 28px 40px 28px]' : '[28px minmax(90px, auto) 28px 1fr]'}
      alignItems="center"
      columnGap="6"
      rowGap="4"
      mb="4"
    >
      {/* the name takes a line of its own above the buttons, unless it is a short one on the same line */}
      <Box as="span" gridColumn={props.inline ? 'auto' : '[1 / -1]'}>
        <IconText id={props.icon}>{props.name}</IconText>
      </Box>
      <Button
        class={control}
        locked={props.atMin}
        onPress={() => {
          props.onStep(-1);
        }}
      >
        −
      </Button>
      <Box as="b" textAlign="center">
        {props.value}
      </Box>
      <Button
        class={control}
        locked={props.atMax}
        onPress={() => {
          props.onStep(1);
        }}
      >
        +
      </Button>
    </Box>
  );
}

/** One setting's card: its name, its controls, and a word on what it trades off. */
function Card(props: { children: ComponentChildren }) {
  return (
    <Box bg="bg.card" border="card" borderRadius="12" py="8" px="10" fontSize="14">
      {props.children}
    </Box>
  );
}

/** A card's heading, or a heading partway down one. */
function Heading(props: { children: ComponentChildren }) {
  return (
    <Box as="h4" fontWeight="bold" mt="2" mb="6">
      {props.children}
    </Box>
  );
}

/** What a setting trades off, in smaller and fainter words under it. */
function Note(props: { children: ComponentChildren }) {
  return (
    <Box as="p" fontSize="13" opacity="muted" mt="6" mb="8">
      {props.children}
    </Box>
  );
}

/** The center's policy, each setting with a word on what it trades off. */
export function PolicyMenu() {
  const { sim } = useGame();
  const p = sim.s.policy;
  const roles = ROLE_ORDER.filter((r) => sim.s.staff.some((st) => st.role === r));
  return (
    <div class={cx(panelCard(), menuPanel)}>
      <h3>Policy</h3>
      <Box display="grid" gridTemplateColumns="[repeat(auto-fit, minmax(220px, 1fr))]" gap="12">
        <Card>
          <Heading>Diagnosis</Heading>
          <Stepper
            name="Treat once a diagnosis is"
            value={`${percent(p.diagnosis)} sure`}
            atMin={p.diagnosis <= DIAGNOSIS_MIN}
            atMax={p.diagnosis >= DIAGNOSIS_MAX}
            onStep={(by) => {
              sim.setPolicy({ diagnosis: p.diagnosis + by * 0.05 });
            }}
          />
          <Note>
            Surer diagnoses make treatments likelier to work, but take more consultations and longer waits. Nobody is
            consulted more than four times.
          </Note>
        </Card>
        <Card>
          <Heading>Emergencies</Heading>
          <Button
            class={`${control} ${toggle}${p.emergenciesFirst ? ' on' : ''}`}
            onPress={() => {
              sim.setPolicy({ emergenciesFirst: !p.emergenciesFirst });
            }}
          >
            <IconText id="ui-emergency">
              {p.emergenciesFirst ? 'Emergencies first: on' : 'Emergencies first: off'}
            </IconText>
          </Button>
          <Note>Emergency guests are called ahead of everyone else in line, whatever their place in it.</Note>
        </Card>
        {sim.mushroomSupplier() && (
          <Card>
            <Heading>Mushrooms</Heading>
            <Button
              class={`${control} ${toggle}${p.stashMushrooms ? ' on' : ''}`}
              onPress={() => {
                sim.setPolicy({ stashMushrooms: !p.stashMushrooms });
              }}
            >
              <IconText id="bubble-mushroom">
                {p.stashMushrooms ? 'Hide from inspector: on' : 'Hide from inspector: off'}
              </IconText>
            </Button>
            <Note>
              The mushrooms under the Shop Counter are put away as soon as the health inspector writes ahead, and come
              back out once they have gone.
            </Note>
          </Card>
        )}
        <Card>
          <Heading>Breaks</Heading>
          <Stepper
            name="Take a break below"
            value={`${p.breakAt} energy`}
            atMin={p.breakAt <= BREAK_AT_MIN}
            atMax={p.breakAt >= BREAK_AT_MAX}
            onStep={(by) => {
              sim.setPolicy({ breakAt: p.breakAt + by * 5 });
            }}
          />
          <Note>Earlier breaks keep staff fresher, but leave their stations empty more often.</Note>
          {roles.length > 0 && <Heading>On a break at once</Heading>}
          {roles.map((role) => {
            const limit = p.breakLimit[role] ?? 0;
            return (
              <Stepper
                key={role}
                inline
                name={`${ROLES[role].name}s`}
                icon={ROLES[role].icon}
                value={limit ? `${limit}` : 'Any'}
                atMin={limit === 1}
                atMax={!limit}
                onStep={(by) => {
                  // no limit sits above the highest one: down from it starts there, and up past it comes back to it
                  const next = limit ? limit + by : by < 0 ? MAX_BREAK_LIMIT : 0;
                  sim.setPolicy({ breakLimit: { role, limit: next > MAX_BREAK_LIMIT ? 0 : next } });
                }}
              />
            );
          })}
        </Card>
      </Box>
    </div>
  );
}
