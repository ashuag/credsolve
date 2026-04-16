import { useEffect, type RefObject } from 'react';

/**
 * Calls `handler` when a mousedown event fires outside the given `ref` element.
 * Only attaches the listener when `enabled` is true.
 */
export function useOutsideClick<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    }

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [ref, handler, enabled]);
}
