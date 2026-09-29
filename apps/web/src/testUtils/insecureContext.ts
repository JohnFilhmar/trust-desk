const original = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");

/**
 * Makes `crypto.randomUUID` undefined, as it is in a browser on a plain HTTP
 * origin that is not localhost. Call `restoreRandomUuid` after the test.
 */
export function removeRandomUuid(): void {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

/** Puts `crypto.randomUUID` back the way the test environment provided it. */
export function restoreRandomUuid(): void {
  if (original === undefined) {
    // The function lives on the prototype, so removing the own property
    // that hid it brings it back.
    Reflect.deleteProperty(globalThis.crypto, "randomUUID");
    return;
  }
  Object.defineProperty(globalThis.crypto, "randomUUID", original);
}
