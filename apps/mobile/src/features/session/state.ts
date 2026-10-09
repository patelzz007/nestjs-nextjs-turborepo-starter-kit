import { z } from "zod";

import type { SessionScopeInfo } from "./access-token-claims";

/**
 * Why the device is signed out — the sign-in screen explains it:
 * - `none`: never signed in, or a cold start without a session;
 * - `signedOut`: the user signed out (or out everywhere);
 * - `sessionExpired`: the API ended the session (refresh refused, device revoked) — §6.4;
 * - `appLockReset`: the device's biometrics changed while the app lock was on — §11.2;
 * - `passwordChanged`: the password was changed here, which signs out every session, this one included.
 */
export const SignedOutReasonSchema = z.enum(["none", "signedOut", "sessionExpired", "appLockReset", "passwordChanged"]);

export type SignedOutReason = z.output<typeof SignedOutReasonSchema>;

/**
 * The session state machine of the root guard (docs/technical/mobile/mobile-app.md §9.6).
 * `ConfigError` is decided before this store exists (an invalid environment
 * builds no API client), so it is not a state here.
 */
export type SessionState =
	| { readonly status: "starting" }
	| { readonly status: "signedOut"; readonly reason: SignedOutReason }
	| { readonly status: "locked" }
	| { readonly status: "signedIn"; readonly session: SessionScopeInfo }
	| { readonly status: "upgradeRequired"; readonly minimumVersion: string | null };

export const INITIAL_SESSION_STATE: SessionState = { status: "starting" };
