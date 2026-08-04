// ============================================
// lib/auth-sync.ts - Cross-tab auth state sync
// BroadcastChannel-based: a logout in one tab logs out every tab sharing the
// same auth context (web vs admin cookie set), closing the rotation-race gap
// documented in docs/token-refresh.md where a proxy rotation in one tab could
// invalidate an in-flight refresh in another.
// ============================================

/**
 * Cross-tab auth events. Only state *changes* are broadcast — never tokens.
 *
 * - `"logged-out"`  — a tab cleared its session (local logout, failed refresh,
 *                     or 401 unauthorised). Receivers clear their own session.
 * - `"logged-in"`   — a tab established a session (login). Receivers mark
 *                     themselves authenticated so they don't bounce to login.
 */
export type AuthSyncEvent = "logged-out" | "logged-in";

/**
 * A thin wrapper over a single `BroadcastChannel` that is safe to use in
 * environments without the API (old browsers, jsdom tests, SSR — `post` no-ops
 * and `subscribe` never fires). Each call creates an independent channel on
 * the given name; real browsers deliver between independent channels (tabs)
 * sharing a name automatically.
 */
export interface AuthChannel {
	readonly name: string;
	post(event: AuthSyncEvent): void;
	subscribe(handler: (event: AuthSyncEvent) => void): () => void;
	close(): void;
}

/**
 * Create an independent sync channel for an auth context (web vs admin). Each
 * `AuthProvider` owns its channel and closes it on unmount. In the browser,
 * tabs open the same-named channel and receive each other's messages; in
 * environments without BroadcastChannel everything degrades to no-ops.
 */
export function createAuthChannel(name: string): AuthChannel {
	if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
		return {
			name,
			post: (): void => undefined,
			subscribe: (): (() => void) => (): void => undefined,
			close: (): void => undefined,
		};
	}

	const channel: BroadcastChannel = new BroadcastChannel(name);
	let closed = false;

	return {
		name,
		post(event: AuthSyncEvent): void {
			if (!closed) {
				channel.postMessage(event);
			}
		},
		subscribe(handler: (event: AuthSyncEvent) => void): () => void {
			const onMessage = (message: MessageEvent<unknown>): void => {
				// Validate the payload — other tabs might post anything.
				if (message.data === "logged-out" || message.data === "logged-in") {
					handler(message.data);
				}
			};
			channel.addEventListener("message", onMessage);
			return (): void => {
				channel.removeEventListener("message", onMessage);
			};
		},
		close(): void {
			if (!closed) {
				closed = true;
				channel.close();
			}
		},
	};
}
