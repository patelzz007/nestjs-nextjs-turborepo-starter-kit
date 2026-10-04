import { assertNever } from "@workspace/shared";

import { SESSION_CHECK_MAX_RETRIES, type SessionCheckFailureReason } from "../../auth/session/session-check";
import type { AuthAction } from "./actions";
import { SESSION_CHECK_OK, type AuthSessionState, type SessionCheckState } from "./state";

/**
 * A restored session continues the current epoch only when it is the session
 * this tab already had: the first check of the page (the session the server
 * rendered for) or the same subject re-confirmed. Anyone else is a new epoch.
 */
function epochAfterRestore(state: AuthSessionState, userId: string): number {
	const continuesSession = state.status === "unknown" || (state.status === "authenticated" && state.userId === userId);
	return continuesSession ? state.epoch : state.epoch + 1;
}

/** The state with no failed check to report — the same object when there was none. */
function withSettledCheck(state: AuthSessionState): AuthSessionState {
	return state.check.status === "ok" ? state : { ...state, check: SESSION_CHECK_OK };
}

/**
 * One more failed check in the current series. Within the retry budget the
 * tab retries by itself; past it, it waits for a trigger. Only the check
 * changes — never the session status or the epoch.
 */
function checkAfterFailure(check: SessionCheckState, reason: SessionCheckFailureReason): SessionCheckState {
	const failedAttempts = (check.status === "ok" ? 0 : check.failedAttempts) + 1;
	return failedAttempts > SESSION_CHECK_MAX_RETRIES ? { status: "paused", reason, failedAttempts } : { status: "retrying", reason, failedAttempts };
}

/** Pure client-session transitions — no I/O, no cookies, no query client, no browser APIs. */
export function authReducer(state: AuthSessionState, action: AuthAction): AuthSessionState {
	switch (action.type) {
		case "[ Auth ] Session Established":
			// A sign-in is always a new session, even for the same member.
			return { status: "authenticated", userId: action.profile.data.id, epoch: state.epoch + 1, check: SESSION_CHECK_OK };
		case "[ Auth ] Session Restored":
			// The scope is not stored: the facade derives it from `/auth/permissions`
			// (seeded here when the check got an answer, pending — fail closed — when not).
			return { status: "authenticated", userId: action.profile.data.id, epoch: epochAfterRestore(state, action.profile.data.id), check: SESSION_CHECK_OK };
		case "[ Auth ] Session Not Found":
			// A signed-out tab keeps its reason (an invalidated one keeps the silent refresh off until a
			// sign-in or a found session). Losing a known or unconfirmed session starts a new epoch.
			return state.status === "signed-out" ? withSettledCheck(state) : { status: "signed-out", reason: "no-session", epoch: state.epoch + 1, check: SESSION_CHECK_OK };
		case "[ Auth ] Session Check Failed":
			// No verdict, so nothing about the session changes: an authenticated tab stays
			// authenticated (its cache too), an unknown one stays unknown — never signed out.
			return { ...state, check: checkAfterFailure(state.check, action.reason) };
		case "[ Auth ] Session Recheck Requested":
			// A new series: the retry budget starts over. Nothing to restart while no check failed.
			return state.check.status === "ok" ? state : { ...state, check: { status: "retrying", reason: state.check.reason, failedAttempts: 0 } };
		case "[ Auth ] Session Check Skipped":
			// Only settles the first check; a session this tab already knows about is kept.
			return state.status === "unknown" ? { status: "signed-out", reason: "no-session", epoch: state.epoch, check: SESSION_CHECK_OK } : withSettledCheck(state);
		case "[ Auth ] Signed Out":
			return { status: "signed-out", reason: "signed-out", epoch: state.epoch + 1, check: SESSION_CHECK_OK };
		case "[ Auth ] Session Expired":
			return { status: "signed-out", reason: "session-expired", epoch: state.epoch + 1, check: SESSION_CHECK_OK };
		case "[ Auth ] Signed Out In Another Tab":
			return { status: "signed-out", reason: "signed-out-in-another-tab", epoch: state.epoch + 1, check: SESSION_CHECK_OK };
		case "[ Auth ] Server Session Cleared":
			// Bookkeeping for the timeline (and the cross-tab effect); the state already changed at sign-out.
			return state;
		default:
			return assertNever(action, "auth action");
	}
}
