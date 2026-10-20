// ============================================
// use-sign-out.ts - sign out and sign out everywhere (§10.9, §10.10)
// ============================================
// Both are the token transport's lifecycle calls: the API identifies the
// session by the stored refresh token in the body (ADR 029).
// - Sign out revokes this device session, then always clears the tokens: the
//   device leaves even when the API refuses, cannot be reached, or does not
//   answer within SIGN_OUT_REVOKE_TIMEOUT_MS (the session then ends at its
//   expiry, or from the device list on another client).
// - Sign out everywhere must succeed to leave: on failure the devices are still
//   signed in, and saying otherwise would be a lie (same as the web).

import { apiRouter, fetchBodyTokenLifecycleMutation, UpgradeRequiredError } from "@workspace/api-client";
import * as React from "react";

import { useApiClient } from "../../../lib/api-context";
import { minimumVersionOf } from "../../../lib/query-client";
import { useReadyRuntime } from "../../../runtime/runtime-context";
import { useSessionCommands } from "../../../features/session/facade";
import { signOutDevice } from "./sign-out-device";

export interface SignOutCommands {
	readonly signOut: () => Promise<void>;
	/** `true` when every session was revoked and this device left; `false` when nothing changed. */
	readonly signOutEverywhere: () => Promise<boolean>;
}

export function useSignOut(): SignOutCommands {
	const { context } = useApiClient();
	const { tokenProvider } = useReadyRuntime();
	const session = useSessionCommands();

	return React.useMemo((): SignOutCommands => {
		const leave = async (): Promise<void> => {
			await tokenProvider.clearTokens();
			session.signedOut("signedOut");
		};
		return {
			signOut: async (): Promise<void> => {
				await signOutDevice({
					revoke: async (signal: AbortSignal): Promise<boolean> => (await fetchBodyTokenLifecycleMutation(context, apiRouter.auth.logout, { signal })).ok,
					leave,
				});
			},
			signOutEverywhere: async (): Promise<boolean> => {
				const response = await fetchBodyTokenLifecycleMutation(context, apiRouter.auth.logoutAll);
				if (!response.ok) {
					if (response.error instanceof UpgradeRequiredError) {
						session.upgradeRequired(minimumVersionOf(response.error));
					}
					return false;
				}
				await leave();
				return true;
			},
		};
	}, [context, session, tokenProvider]);
}
