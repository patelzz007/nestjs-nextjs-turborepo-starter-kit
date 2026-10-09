import type { SessionScopeInfo } from "./access-token-claims";
import type { SignedOutReason } from "./state";

/** What the app found on the device at start (after the environment and preferences loaded). */
export type RestoredSession =
	{ readonly status: "signedOut"; readonly reason: SignedOutReason } | { readonly status: "locked" } | { readonly status: "signedIn"; readonly session: SessionScopeInfo };

/** Everything that can happen to the session. */
export type SessionAction =
	| { readonly type: "[ Session ] Restored"; readonly restored: RestoredSession }
	| { readonly type: "[ Session ] Signed In"; readonly session: SessionScopeInfo }
	| { readonly type: "[ Session ] Tokens Rotated"; readonly session: SessionScopeInfo }
	| { readonly type: "[ Session ] Signed Out"; readonly reason: SignedOutReason }
	| { readonly type: "[ Session ] Expired" }
	| { readonly type: "[ Session ] Locked" }
	| { readonly type: "[ Session ] Unlocked"; readonly session: SessionScopeInfo }
	| { readonly type: "[ Session ] Upgrade Required"; readonly minimumVersion: string | null };

export const sessionActions = {
	restored: (restored: RestoredSession): SessionAction => ({ type: "[ Session ] Restored", restored }),
	signedIn: (session: SessionScopeInfo): SessionAction => ({ type: "[ Session ] Signed In", session }),
	tokensRotated: (session: SessionScopeInfo): SessionAction => ({ type: "[ Session ] Tokens Rotated", session }),
	signedOut: (reason: SignedOutReason): SessionAction => ({ type: "[ Session ] Signed Out", reason }),
	expired: (): SessionAction => ({ type: "[ Session ] Expired" }),
	locked: (): SessionAction => ({ type: "[ Session ] Locked" }),
	unlocked: (session: SessionScopeInfo): SessionAction => ({ type: "[ Session ] Unlocked", session }),
	upgradeRequired: (minimumVersion: string | null): SessionAction => ({ type: "[ Session ] Upgrade Required", minimumVersion }),
};
