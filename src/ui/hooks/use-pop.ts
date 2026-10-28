// The little pop a panel makes when it opens.

import { useEffect, useRef, useState } from 'preact/hooks';

/** The class that animates a panel in, for a moment after it opens and not on every redraw. */
export function usePop(open: boolean): string {
  const [popping, setPopping] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    const opened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!opened) return undefined;
    setPopping(true);
    const timer = setTimeout(() => {
      setPopping(false);
    }, 220);
    // shut before the pop is over, it stops popping too, or the class stays on the empty panel until it next opens
    return () => {
      clearTimeout(timer);
      setPopping(false);
    };
  }, [open]);
  return popping ? 'pop' : '';
}
