import type { Envelope, SessionPermissionsResponse, UserResponse } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { envelopeFixture, sessionPermissionsFixture, userFixture } from "../../../test/auth-fixtures";
import type { AuthSyncEvent } from "../../auth/session/sync";
import { authActions } from "./actions";
import type { AuthBroadcaster, AuthQueryCache } from "./effects";
import { SESSION_CHECK_OK } from "./state";
import { createAuthStore, type AuthStore } from "./store";

/** A profile as the API answered it — the envelope with its real-shaped `meta`. */
function profileEnvelope(overrides: Partial<UserResponse> = {}): Envelope<UserResponse> {
	return envelopeFixture(userFixture(overrides));
}

/** Everything the effects did, in order: cache writes and cross-tab posts on one timeline. */
type SideEffect =
	| { readonly kind: "seed-profile"; readonly profile: Envelope<UserResponse> }
	| { readonly kind: "seed-permissions"; readonly permissions: Envelope<SessionPermissionsResponse> }
	| { readonly kind: "drop-permissions" }
	| { readonly kind: "clear-cache" }
	| { readonly kind: "post"; readonly event: AuthSyncEvent };

interface Harness {
	readonly store: AuthStore;
	readonly sideEffects: SideEffect[];
}

/** A fake cache that remembers whose profile it holds, like the real `/auth/me` entry. */
function createHarness(): Harness {
	const sideEffects: SideEffect[] = [];
	let cachedProfileId: string | null = null;
	const queryCache: AuthQueryCache = {
		readProfileId: (): string | null => cachedProfileId,
		seedProfile: (profile: Envelope<UserResponse>): void => {
			cachedProfileId = profile.data.id;
			sideEffects.push({ kind: "seed-profile", profile });
		},
		seedSessionPermissions: (permissions: Envelope<SessionPermissionsResponse>): void => {
			sideEffects.push({ kind: "seed-permissions", permissions });
		},
		dropSessionPermissions: (): void => {
			sideEffects.push({ kind: "drop-permissions" });
		},
		clear: (): void => {
			cachedProfileId = null;
			sideEffects.push({ kind: "clear-cache" });
		},
	};
	const broadcaster: AuthBroadcaster = {
		post: (event: AuthSyncEvent): void => {
			sideEffects.push({ kind: "post", event });
		},
	};
	return { store: createAuthStore({ devtoolsName: "Auth · test", queryCache, broadcaster }), sideEffects };
}

describe("auth store effects", () => {
	it("seeds /auth/me from a sign-in, drops the previous session's permissions and tells the other tabs", () => {
		const { store, sideEffects } = createHarness();
		const profile = profileEnvelope();

		store.dispatch(authActions.sessionEstablished(profile));

		expect(store.getState()).toEqual({ status: "authenticated", userId: profile.data.id, epoch: 1, check: SESSION_CHECK_OK });
		expect(sideEffects).toEqual([{ kind: "drop-permissions" }, { kind: "seed-profile", profile }, { kind: "post", event: "logged-in" }]);
	});

	it("clears the whole cache before another member's sign-in writes anything", () => {
		const { store, sideEffects } = createHarness();
		store.dispatch(authActions.sessionRestored(profileEnvelope({ id: "member-x" }), null));
		sideEffects.length = 0;
		const other = profileEnvelope({ id: "member-y" });

		store.dispatch(authActions.sessionEstablished(other));

		expect(sideEffects.slice(0, 3)).toEqual([{ kind: "clear-cache" }, { kind: "drop-permissions" }, { kind: "seed-profile", profile: other }]);
	});

	it("clears the whole cache when a session check finds another member (they signed in in another tab)", () => {
		const { store, sideEffects } = createHarness();
		store.dispatch(authActions.sessionRestored(profileEnvelope({ id: "member-x" }), null));
		sideEffects.length = 0;
		const other = profileEnvelope({ id: "member-y" });

		store.dispatch(authActions.sessionRestored(other, null));

		expect(sideEffects).toEqual([{ kind: "clear-cache" }, { kind: "seed-profile", profile: other }]);
	});

	it("keeps the cache when a session check re-confirms the same member", () => {
		const { store, sideEffects } = createHarness();
		const profile = profileEnvelope();
		store.dispatch(authActions.sessionRestored(profile, null));
		sideEffects.length = 0;

		store.dispatch(authActions.sessionRestored(profile, null));

		expect(sideEffects).toEqual([{ kind: "seed-profile", profile }]);
	});

	it("clears the cache when a session check no longer finds the session this tab had", () => {
		const { store, sideEffects } = createHarness();
		store.dispatch(authActions.sessionRestored(profileEnvelope(), null));
		sideEffects.length = 0;

		store.dispatch(authActions.sessionNotFound());

		expect(sideEffects).toEqual([{ kind: "clear-cache" }]);
	});

	it("seeds both session queries from a restored session — with the server's own envelopes — without broadcasting", () => {
		const { store, sideEffects } = createHarness();
		const profile = profileEnvelope();
		const permissions = envelopeFixture(sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" }), {
			correlationId: "corr-permissions",
			timestamp: profile.meta.timestamp,
		});

		store.dispatch(authActions.sessionRestored(profile, permissions));

		expect(sideEffects).toEqual([
			{ kind: "seed-profile", profile },
			{ kind: "seed-permissions", permissions },
		]);
	});

	it("never seeds a permissions answer the server did not give", () => {
		const { store, sideEffects } = createHarness();

		store.dispatch(authActions.sessionRestored(profileEnvelope(), null));

		expect(sideEffects.map((effect: SideEffect): SideEffect["kind"] => effect.kind)).toEqual(["seed-profile"]);
	});

	it("clears the query cache for every way of losing the session — synchronously, before dispatch returns", () => {
		for (const invalidation of [authActions.signedOut(), authActions.sessionExpired(), authActions.signedOutInAnotherTab()]) {
			const { store, sideEffects } = createHarness();
			store.dispatch(authActions.sessionEstablished(profileEnvelope()));
			sideEffects.length = 0;

			store.dispatch(invalidation);
			// The cache is empty when `dispatch` returns — before any caller's next step.

			expect(sideEffects).toEqual([{ kind: "clear-cache" }]);
		}
	});

	it("tells the other tabs about a sign-out only once the server session is cleared, and only when asked", () => {
		const { store, sideEffects } = createHarness();

		store.dispatch(authActions.signedOut());
		expect(sideEffects).not.toContainEqual({ kind: "post", event: "logged-out" });

		store.dispatch(authActions.serverSessionCleared(false));
		expect(sideEffects).not.toContainEqual({ kind: "post", event: "logged-out" });

		store.dispatch(authActions.serverSessionCleared(true));
		expect(sideEffects.at(-1)).toEqual({ kind: "post", event: "logged-out" });
	});

	it("re-signs-in the same member (e.g. after email verification) without clearing the cache, but drops the old permissions so the new scope is read", () => {
		const { store, sideEffects } = createHarness();
		store.dispatch(authActions.sessionEstablished(profileEnvelope({ isEmailVerified: false })));
		sideEffects.length = 0;
		const verified = profileEnvelope({ isEmailVerified: true });

		store.dispatch(authActions.sessionEstablished(verified));

		expect(sideEffects).toEqual([{ kind: "drop-permissions" }, { kind: "seed-profile", profile: verified }, { kind: "post", event: "logged-in" }]);
		expect(store.getState()).toEqual({ status: "authenticated", userId: verified.data.id, epoch: 2, check: SESSION_CHECK_OK });
	});

	it("keeps the cache and tells no tab when a check of a signed-in tab cannot reach the API", () => {
		const { store, sideEffects } = createHarness();
		const profile = profileEnvelope();
		store.dispatch(authActions.sessionRestored(profile, null));
		sideEffects.length = 0;

		store.dispatch(authActions.sessionCheckFailed("server-error"));
		store.dispatch(authActions.sessionRecheckRequested("online"));
		store.dispatch(authActions.sessionCheckFailed("network"));

		expect(sideEffects).toEqual([]);
		expect(store.getState()).toMatchObject({ status: "authenticated", userId: profile.data.id, epoch: 0 });
	});

	it("does nothing outside the store for a guest's checks and skips", () => {
		const { store, sideEffects } = createHarness();

		store.dispatch(authActions.sessionCheckSkipped());
		store.dispatch(authActions.sessionNotFound());

		expect(sideEffects).toEqual([]);
	});

	it("gives every store its own session — nothing is shared between mounts or requests", () => {
		const first = createHarness();
		const second = createHarness();

		first.store.dispatch(authActions.sessionEstablished(profileEnvelope()));

		expect(second.store.getState()).toEqual({ status: "unknown", epoch: 0, check: SESSION_CHECK_OK });
		expect(second.sideEffects).toEqual([]);
	});
});
