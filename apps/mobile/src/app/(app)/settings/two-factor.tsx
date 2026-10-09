// ============================================
// Turn on 2FA / generate new backup codes from Security (§10.5, §10.10)
// ============================================
// `?mode=setup` turns two-factor authentication on; `?mode=rotate` issues a new
// secret and new backup codes. The mode is a route param, parsed with zod.

import { apiRouter } from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as React from "react";
import { z } from "zod";

import { Screen } from "../../../components/screen";
import { useRefreshSession } from "../../../features/auth/use-refresh-session";
import { TwoFactorEnrollment, TwoFactorEnrollmentModeSchema } from "../../../features/two-factor/two-factor-enrollment";
import { useRouteParams } from "../../../lib/route-params";
import { ROUTES } from "../../../runtime/routes";

export const TwoFactorSetupRouteParamsSchema = z.object({ mode: TwoFactorEnrollmentModeSchema.default("setup") });

export default function TwoFactorSetupScreen(): React.JSX.Element {
	const params = useRouteParams(TwoFactorSetupRouteParamsSchema);
	const mode = params?.mode ?? "setup";
	const router = useRouter();
	const queryClient = useQueryClient();
	const refreshSession = useRefreshSession();

	const finish = React.useCallback(async (): Promise<string | null> => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: apiRouter.auth.me.scopeKey(undefined) }),
			queryClient.invalidateQueries({ queryKey: apiRouter.auth.twoFactorBackupCodesRemaining.scopeKey(undefined) }),
		]);
		// Back to Security; opened directly (no history), go there instead.
		if (router.canGoBack()) {
			router.back();
		} else {
			router.replace(ROUTES.security);
		}
		return null;
	}, [queryClient, router]);

	return (
		<Screen title={mode === "setup" ? "Turn on two-factor authentication" : "New backup codes"}>
			<TwoFactorEnrollment mode={mode} afterTokenVersionBump={refreshSession} onComplete={finish} completeLabel="Done" />
		</Screen>
	);
}
