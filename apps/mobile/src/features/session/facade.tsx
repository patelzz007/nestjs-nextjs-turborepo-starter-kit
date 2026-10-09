// The session feature's facade: the only module screens import (ADR 023).

import type { EnrollmentReason } from "@workspace/shared";
import * as React from "react";

import { createFeatureStoreContext } from "../../lib/state/feature-store-context";
import type { SessionScopeInfo } from "./access-token-claims";
import { sessionActions, type RestoredSession, type SessionAction } from "./actions";
import { selectEnrollmentReason, selectMinimumVersion, selectRootRoute, selectSignedOutReason, type RootRoute } from "./selectors";
import type { SessionState, SignedOutReason } from "./state";

const sessionContext = createFeatureStoreContext<SessionState, SessionAction>("Session");

export const SessionStoreProvider = sessionContext.provider;

export function useRootRoute(): RootRoute {
	return sessionContext.useFeatureSelector(selectRootRoute);
}

export function useEnrollmentReason(): EnrollmentReason | null {
	return sessionContext.useFeatureSelector(selectEnrollmentReason);
}

export function useSignedOutReason(): SignedOutReason | null {
	return sessionContext.useFeatureSelector(selectSignedOutReason);
}

export function useMinimumVersion(): string | null {
	return sessionContext.useFeatureSelector(selectMinimumVersion);
}

/** The current session state without subscribing — for event handlers (AppState changes). */
export function useSessionSnapshot(): () => SessionState {
	return sessionContext.useFeatureStore().getState;
}

export interface SessionCommands {
	readonly restored: (restored: RestoredSession) => void;
	readonly signedIn: (session: SessionScopeInfo) => void;
	readonly tokensRotated: (session: SessionScopeInfo) => void;
	readonly signedOut: (reason: SignedOutReason) => void;
	readonly expired: () => void;
	readonly locked: () => void;
	readonly unlocked: (session: SessionScopeInfo) => void;
	readonly upgradeRequired: (minimumVersion: string | null) => void;
}

/** Stable commands that describe what happened to the session. */
export function useSessionCommands(): SessionCommands {
	const { dispatch } = sessionContext.useFeatureStore();
	return React.useMemo(
		(): SessionCommands => ({
			restored: (restored: RestoredSession): void => {
				dispatch(sessionActions.restored(restored));
			},
			signedIn: (session: SessionScopeInfo): void => {
				dispatch(sessionActions.signedIn(session));
			},
			tokensRotated: (session: SessionScopeInfo): void => {
				dispatch(sessionActions.tokensRotated(session));
			},
			signedOut: (reason: SignedOutReason): void => {
				dispatch(sessionActions.signedOut(reason));
			},
			expired: (): void => {
				dispatch(sessionActions.expired());
			},
			locked: (): void => {
				dispatch(sessionActions.locked());
			},
			unlocked: (session: SessionScopeInfo): void => {
				dispatch(sessionActions.unlocked(session));
			},
			upgradeRequired: (minimumVersion: string | null): void => {
				dispatch(sessionActions.upgradeRequired(minimumVersion));
			},
		}),
		[dispatch],
	);
}
