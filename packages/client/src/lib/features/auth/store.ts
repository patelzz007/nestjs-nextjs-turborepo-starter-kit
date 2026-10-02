import { createFeatureStore, type FeatureStore } from "../../state/feature-store";
import type { AuthAction } from "./actions";
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
}

/**
 * One client-session store, starting `unknown`. Never persisted: a reload
 * learns the status again from the server (`[ Auth ] Session Restored` /
 * `Session Not Found`), so nothing about the session ever reaches storage.
 */
export function createAuthStore(dependencies: AuthStoreDependencies): AuthStore {
	return createFeatureStore<AuthSessionState, AuthAction>({
		name: dependencies.devtoolsName,
		initialState: INITIAL_AUTH_SESSION_STATE,
		reducer: authReducer,
		effects: [createAuthQueryCacheEffect(dependencies.queryCache), createAuthTabSyncEffect(dependencies.broadcaster)],
	});
}
