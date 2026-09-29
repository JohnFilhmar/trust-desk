import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Moves keyboard focus to an element each time a value changes to something
 * other than null. It is for a message that replaces the button the person
 * just used, so that focus is not lost with the button.
 *
 * @param value - What the message is about. Null means there is no message, and nothing is focused.
 * @returns The ref to put on the element. The element needs `tabIndex={-1}`.
 */
export function useFocusOnChange<TElement extends HTMLElement>(
  value: unknown,
): RefObject<TElement> {
  const elementRef = useRef<TElement>(null);
  useEffect(() => {
    if (value !== null) {
      elementRef.current?.focus();
    }
  }, [value]);
  return elementRef;
}
