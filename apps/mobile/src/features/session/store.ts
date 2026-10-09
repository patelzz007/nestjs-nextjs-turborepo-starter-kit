import { createFeatureStore, type FeatureEffect, type FeatureStore } from "../../lib/state/feature-store";
import type { SessionAction } from "./actions";
import { sessionReducer } from "./reducer";
import { INITIAL_SESSION_STATE, type SessionState } from "./state";

export type SessionStore = FeatureStore<SessionState, SessionAction>;

export interface SessionStoreDependencies {
	/** Drops every cached server response (the query cache) — called whenever the signed-in identity is gone. */
	readonly clearServerState: () => void;
}

/** Leaving a session (sign-out, expiry, upgrade wall) clears every cached response of the previous user. */
function clearServerStateEffect(dependencies: SessionStoreDependencies): FeatureEffect<SessionState, SessionAction> {
	return (action: SessionAction): void => {
		switch (action.type) {
			case "[ Session ] Signed Out":
			case "[ Session ] Expired":
			case "[ Session ] Upgrade Required":
				dependencies.clearServerState();
				return;
			default:
				return;
		}
	};
}

/** Creates the session store — once per app start (src/app/_layout.tsx). */
export function createSessionStore(dependencies: SessionStoreDependencies): SessionStore {
	return createFeatureStore<SessionState, SessionAction>({
		initialState: INITIAL_SESSION_STATE,
		reducer: sessionReducer,
		effects: [clearServerStateEffect(dependencies)],
	});
}
