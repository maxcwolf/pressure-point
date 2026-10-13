// Text that drifts up from a point in the world, such as money earned.

import './Floaters.css';

import { useHud } from '../hooks/use-hud';

/** The floating text currently on screen. */
export function Floaters() {
  const { floaters } = useHud();
  return (
    <>
      {floaters.map((f) => (
        <div key={f.id} class={`floater ${f.kind}`} style={{ left: `${f.x}px`, top: `${f.y}px` }}>
          {f.text}
        </div>
      ))}
    </>
  );
}
