import { assertNever } from "@workspace/shared";

import type { SessionAction } from "./actions";
import type { SessionState } from "./state";

/**
 * The root guard's transitions (§9.6), pure. A transition the diagram does not
 * have leaves the state unchanged:
 * - `upgradeRequired` is final — nothing leaves it (the update screen cannot be dismissed);
 * - only a signed-in app can lock, and only a locked app can unlock;
 * - a session can only expire while one exists (signed in or locked).
 */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
	if (state.status === "upgradeRequired") {
		return state;
	}
	switch (action.type) {
		case "[ Session ] Restored":
			return state.status === "starting" ? action.restored : state;
		case "[ Session ] Signed In":
			return state.status === "signedOut" || state.status === "signedIn" ? { status: "signedIn", session: action.session } : state;
		case "[ Session ] Tokens Rotated":
			return state.status === "signedIn" ? { status: "signedIn", session: action.session } : state;
		case "[ Session ] Signed Out":
			return state.status === "starting" ? state : { status: "signedOut", reason: action.reason };
		case "[ Session ] Expired":
			return state.status === "signedIn" || state.status === "locked" ? { status: "signedOut", reason: "sessionExpired" } : state;
		case "[ Session ] Locked":
			return state.status === "signedIn" ? { status: "locked" } : state;
		case "[ Session ] Unlocked":
			return state.status === "locked" ? { status: "signedIn", session: action.session } : state;
		case "[ Session ] Upgrade Required":
			return { status: "upgradeRequired", minimumVersion: action.minimumVersion };
		default:
			return assertNever(action, "session action");
	}
}
