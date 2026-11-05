"use client";

import { useSyncExternalStore } from "react";

import { passkeysSupported } from "./browser-passkeys";

/** Browser support never changes while a page is open: nothing to subscribe to. */
function subscribe(): () => void {
	return (): void => undefined;
}

/** The server render (and the hydrating client) never offers a passkey: WebAuthn exists only in a browser. */
function serverSnapshot(): boolean {
	return false;
}

/**
 * Whether this browser can run a passkey ceremony. `false` while rendering on the server and hydrating, then the
 * browser's real answer, with no extra render pass through an effect.
 */
export function usePasskeysSupported(): boolean {
	return useSyncExternalStore(subscribe, passkeysSupported, serverSnapshot);
}
