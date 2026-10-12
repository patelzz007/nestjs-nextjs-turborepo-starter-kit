import type { ServerRenderedSession } from "../../auth/session/server-rendered-session";
import { createFeatureStore, type FeatureStore } from "../../state/feature-store";
import { authActions, type AuthAction } from "./actions";
import { createAuthQueryCacheEffect, createAuthTabSyncEffect, type AuthBroadcaster, type AuthQueryCache } from "./effects";
import { authReducer } from "./reducer";
import { INITIAL_AUTH_SESSION_STATE, type AuthSessionState } from "./state";

export type AuthStore = FeatureStore<AuthSessionState, AuthAction>;

export interface AuthStoreDependencies {
	/** Redux DevTools instance name (e.g. `Auth · admin`). */
	readonly devtoolsName: string;
	/** The session's slice of this provider's QueryClient (a fake in tests). */
	readonly queryCache: AuthQueryCache;
	/** The cross-tab channel for this cookie set (a fake in tests). */
	readonly broadcaster: AuthBroadcaster;
	/**
	 * The session the server rendered the page for. The store starts from it —
	 * `[ Auth ] Session Restored`, the session check's own transition, with its
	 * cache seeding — instead of `unknown`, in the server-rendered epoch.
	 */
	readonly serverSession?: ServerRenderedSession | undefined;
}

/**
 * One client-session store, starting `unknown` — or authenticated, when the
 * server rendered the page for a session it confirmed with the API. Never
 * persisted: a reload learns the status again from the server
 * (`[ Auth ] Session Restored` / `Session Not Found`), so nothing about the
 * session ever reaches storage.
 */
export function createAuthStore(dependencies: AuthStoreDependencies): AuthStore {
	return createFeatureStore<AuthSessionState, AuthAction>({
		name: dependencies.devtoolsName,
		initialState: INITIAL_AUTH_SESSION_STATE,
		reducer: authReducer,
		effects: [createAuthQueryCacheEffect(dependencies.queryCache), createAuthTabSyncEffect(dependencies.broadcaster)],
		initialActions: dependencies.serverSession === undefined ? [] : [authActions.sessionRestored(dependencies.serverSession.profile, dependencies.serverSession.permissions)],
	});
}
