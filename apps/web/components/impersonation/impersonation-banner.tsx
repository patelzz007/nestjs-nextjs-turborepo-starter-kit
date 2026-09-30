"use client";

import { useWebSession } from "@/components/auth/web-authorization-provider";
import { invalidateSessionAuth } from "@workspace/client/lib/auth/session/invalidate-auth";
import { useAuth } from "@workspace/client/lib/auth";
import { Button } from "@workspace/ui/components/form/button";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import * as React from "react";

/**
 * Banner shown while a super-admin is impersonating another user (web app).
 * `POST /auth/stop-impersonation` needs no permission (any impersonation
 * session may end itself), so the banner is gated only on the session flag.
 */
export function ImpersonationBanner(): React.JSX.Element | null {
	const { session } = useWebSession();

	if (session?.isImpersonating !== true) {
		return null;
	}

	return <ImpersonationBannerContent />;
}

function ImpersonationBannerContent(): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const stopMutation = api.auth.stopImpersonation.useMutation({
		onSuccess: async (): Promise<void> => {
			await invalidateSessionAuth(queryClient);
		},
	});

	const handleStop = React.useCallback((): void => {
		void stopMutation.mutateAsync({});
	}, [stopMutation]);

	return (
		<div className="shrink-0 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2.5">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 items-start gap-2 text-sm leading-snug text-amber-950 dark:text-amber-100">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span className="min-w-0">You are impersonating another user. The web app runs as that account.</span>
				</div>
				<Button size="sm" variant="outline" className="shrink-0" disabled={stopMutation.isPending} onClick={handleStop}>
					{stopMutation.isPending ? "Stopping…" : "Stop impersonation"}
				</Button>
			</div>
		</div>
	);
}
