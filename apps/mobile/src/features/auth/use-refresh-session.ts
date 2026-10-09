// ============================================
// use-refresh-session.ts - finishing an enrollment step (§7.8, §10.5)
// ============================================
// A restricted session becomes a full one through a token refresh: enabling 2FA
// (or verifying the email) bumps the token version, and the next
// `POST /auth/refresh` returns the full session. The refresh is the api-client
// transport's own single-flight refresh, so it can never race a 401's refresh.
// The rotated tokens report their new scope to the session store, and the root
// guard moves the app.

import * as React from "react";

import { useApiClient } from "../../lib/api-context";
import { OFFLINE_ERROR_MESSAGE } from "../../lib/error-messages";
import { useReadyRuntime } from "../../runtime/runtime-context";
import { useSessionCommands } from "../session/facade";

/** Refreshes the session; resolves an error message to show, or `null` on success. */
export function useRefreshSession(): () => Promise<string | null> {
	const { context } = useApiClient();
	const { tokenProvider } = useReadyRuntime();
	const session = useSessionCommands();
	return React.useCallback(async (): Promise<string | null> => {
		if (context.transport?.kind !== "token") {
			return OFFLINE_ERROR_MESSAGE;
		}
		const result = await context.transport.refresh();
		switch (result) {
			case "ok":
				return null;
			case "transient":
				return OFFLINE_ERROR_MESSAGE;
			case "expired":
				await tokenProvider.clearTokens();
				session.expired();
				return null;
		}
	}, [context, session, tokenProvider]);
}
