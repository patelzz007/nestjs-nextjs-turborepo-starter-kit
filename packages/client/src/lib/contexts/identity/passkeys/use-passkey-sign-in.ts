"use client";

// ============================================
// passkeys/use-passkey-sign-in.ts - the login form's two passkey ceremonies (ADR 080)
// ============================================
// Passwordless: ask the API for options (no account named), let the device pick one of this site's passkeys,
// send the assertion. Second step: the same, for the `tempToken` a password sign-in answered. Both hand the
// API's answer to the form's own `onAnswer`, which already knows every outcome (signed in, a new-device code,
// a forced enrollment). The app's client type travels the way its password sign-in sends it.

import type { ApiResponseMeta, LoginClientResponse } from "@workspace/shared";
import { useCallback } from "react";

import { useAuth } from "../index";
import type { LoginFormMode } from "../forms/login-form-types";
import { getPasskeyAssertion } from "./browser-passkeys";

/** A login step's answer: the response body plus the envelope `meta` it came with. */
export interface PasskeyLoginAnswer {
	readonly data: LoginClientResponse;
	readonly meta: ApiResponseMeta;
}

export interface PasskeySignIn {
	/** Signs in with a passkey alone. Rejects with the browser's or the API's error. */
	readonly signInWithPasskey: () => Promise<PasskeyLoginAnswer>;
	/** Finishes a password sign-in with a passkey instead of a code. Rejects with the browser's or the API's error. */
	readonly finishWithPasskey: (tempToken: string) => Promise<PasskeyLoginAnswer>;
}

export function usePasskeySignIn(mode: LoginFormMode): PasskeySignIn {
	const { api } = useAuth();
	const passwordlessOptions = (
		mode === "admin" ? api.auth.adminLoginPasskeyOptions : mode === "merchant" ? api.auth.merchantLoginPasskeyOptions : api.auth.loginPasskeyOptions
	).useMutation();
	const passwordless = (mode === "admin" ? api.auth.adminLoginPasskey : mode === "merchant" ? api.auth.merchantLoginPasskey : api.auth.loginPasskey).useMutation();
	const secondFactorOptions = api.auth.loginPasskeySecondFactorOptions.useMutation();
	const secondFactor = api.auth.loginPasskeySecondFactor.useMutation();

	const signInWithPasskey = useCallback(async (): Promise<PasskeyLoginAnswer> => {
		const { data: started } = await passwordlessOptions.mutateAsync({});
		const response = await getPasskeyAssertion(started.options);
		return passwordless.mutateAsync({ challengeId: started.challengeId, response });
	}, [passwordless, passwordlessOptions]);

	const finishWithPasskey = useCallback(
		async (tempToken: string): Promise<PasskeyLoginAnswer> => {
			const { data: started } = await secondFactorOptions.mutateAsync({ tempToken });
			const response = await getPasskeyAssertion(started.options);
			return secondFactor.mutateAsync({ tempToken, challengeId: started.challengeId, response });
		},
		[secondFactor, secondFactorOptions],
	);

	return { signInWithPasskey, finishWithPasskey };
}
