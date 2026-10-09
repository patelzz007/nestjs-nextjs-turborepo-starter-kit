// ============================================
// use-sign-in-step.ts - finishing a login step on the device (§10.1–10.3)
// ============================================
// Every login step answers the same contract (`LoginClientResponse`). A finished
// step stores the tokens and reports "signed in" to the session store — the
// root guard then moves the app; an unfinished one names the next screen.

import type { BodyTokenPair } from "@workspace/api-client";
import type { LoginClientResponse } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";

import { useReadyRuntime } from "../../runtime/runtime-context";
import { ROUTES } from "../../runtime/routes";
import { readSessionScope } from "../session/access-token-claims";
import { useSessionCommands } from "../session/facade";
import { classifySignInResponse } from "./sign-in-outcome";

/** Shown when the API answered without tokens or with a token the app cannot read. */
export const UNEXPECTED_SIGN_IN_MESSAGE = "Sign-in could not be completed on this device. Please try again.";

/** Stores a finished login's tokens and reports the session. `false` when the access token cannot be read. */
export function useCompleteSignIn(): (tokens: BodyTokenPair) => Promise<boolean> {
	const { tokenProvider } = useReadyRuntime();
	const session = useSessionCommands();
	return React.useCallback(
		async (tokens: BodyTokenPair): Promise<boolean> => {
			const scope = readSessionScope(tokens.accessToken);
			if (scope === null) {
				return false;
			}
			await tokenProvider.saveTokens(tokens);
			session.signedIn(scope);
			return true;
		},
		[session, tokenProvider],
	);
}

/**
 * Handles one login step's answer: finishes the sign-in, or opens the next
 * step (2FA, then the emailed new-device code). Resolves an error message to
 * show, or `null`.
 */
export function useSignInStepHandler(): (response: LoginClientResponse) => Promise<string | null> {
	const router = useRouter();
	const completeSignIn = useCompleteSignIn();
	return React.useCallback(
		async (response: LoginClientResponse): Promise<string | null> => {
			const outcome = classifySignInResponse(response);
			switch (outcome.kind) {
				case "session":
					return (await completeSignIn(outcome.tokens)) ? null : UNEXPECTED_SIGN_IN_MESSAGE;
				case "twoFactor":
					router.push({ pathname: ROUTES.twoFactor, params: { tempToken: outcome.tempToken } });
					return null;
				case "verifyDevice":
					router.push({ pathname: ROUTES.verifyDevice, params: { verificationId: outcome.verificationId } });
					return null;
				case "unexpected":
					return UNEXPECTED_SIGN_IN_MESSAGE;
			}
		},
		[completeSignIn, router],
	);
}
