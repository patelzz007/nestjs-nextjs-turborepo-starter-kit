"use client";

import { invalidateSessionAuth } from "@workspace/client/lib/auth/invalidate-session-auth";
import { useAuth } from "@workspace/client/lib/auth";
import { Button } from "@workspace/ui/components/form/button";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import * as React from "react";

/**
 * Banner shown while a super-admin is impersonating another user.
 */
export function ImpersonationBanner(): React.JSX.Element | null {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const permissionsQuery = api.auth.permissions.useQuery(undefined, {
		retry: 1,
	});

	const stopMutation = api.auth.stopImpersonation.useMutation({
		onSuccess: async (): Promise<void> => {
			await invalidateSessionAuth(queryClient);
		},
	});

	const session = permissionsQuery.data?.data;
	const isImpersonating = session?.isImpersonating === true;

	const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";
	const merchantUrl = process.env.NEXT_PUBLIC_MERCHANT_URL ?? "http://localhost:3003";

	const handleStop = React.useCallback((): void => {
		void stopMutation.mutateAsync({});
	}, [stopMutation]);

	if (!isImpersonating) {
		return null;
	}

	return (
		<div className="shrink-0 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2.5">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 items-start gap-2 text-sm leading-snug text-amber-950 dark:text-amber-100">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span className="min-w-0">You are impersonating another user. Actions run as the impersonated account.</span>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<a href={`${webUrl}/rewardhub`} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
						Consumer portal
					</a>
					<a href={merchantUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
						Merchant portal
					</a>
					<Button size="sm" variant="outline" disabled={stopMutation.isPending} onClick={handleStop}>
						{stopMutation.isPending ? "Stopping…" : "Stop impersonation"}
					</Button>
				</div>
			</div>
		</div>
	);
}
