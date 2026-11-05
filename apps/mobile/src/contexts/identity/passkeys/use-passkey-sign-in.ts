// ============================================
// passkeys/use-passkey-sign-in.ts - the sign-in screens' two passkey ceremonies (ADR 080)
// ============================================
// Passwordless: ask the API for options (no account named), let the phone pick one of the site's passkeys, send
// the assertion. Second step: the same, for the `tempToken` a password sign-in answered. Both resolve the API's
// answer, which the screen hands to the same step handler as every other step (a session, a new-device code).

import type { LoginClientResponse } from "@workspace/shared";
import * as React from "react";

import { useApi } from "../../../lib/api-context";
import { getPasskeyAssertion } from "./device-passkeys";

export interface PasskeySignIn {
	/** Signs in with a passkey alone. Rejects with a `PasskeyDeviceError` (the phone's half) or the API's error. */
	readonly signInWithPasskey: () => Promise<LoginClientResponse>;
	/** Finishes a password sign-in with a passkey instead of a code. */
	readonly finishWithPasskey: (tempToken: string) => Promise<LoginClientResponse>;
}

export function usePasskeySignIn(): PasskeySignIn {
	const api = useApi();
	const passwordlessOptions = api.auth.loginPasskeyOptions.useMutation();
	const passwordless = api.auth.loginPasskey.useMutation();
	const secondFactorOptions = api.auth.loginPasskeySecondFactorOptions.useMutation();
	const secondFactor = api.auth.loginPasskeySecondFactor.useMutation();

	const signInWithPasskey = React.useCallback(async (): Promise<LoginClientResponse> => {
		const { data: started } = await passwordlessOptions.mutateAsync({});
		const response = await getPasskeyAssertion(started.options);
		return (await passwordless.mutateAsync({ challengeId: started.challengeId, response })).data;
	}, [passwordless, passwordlessOptions]);

	const finishWithPasskey = React.useCallback(
		async (tempToken: string): Promise<LoginClientResponse> => {
			const { data: started } = await secondFactorOptions.mutateAsync({ tempToken });
			const response = await getPasskeyAssertion(started.options);
			return (await secondFactor.mutateAsync({ tempToken, challengeId: started.challengeId, response })).data;
		},
		[secondFactor, secondFactorOptions],
	);

	return { signInWithPasskey, finishWithPasskey };
}
