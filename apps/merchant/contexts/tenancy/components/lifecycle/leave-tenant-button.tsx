"use client";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { Button } from "@workspace/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

export interface LeaveTenantButtonProps {
	readonly tenantSlug: string;
	readonly tenantName: string;
}

/**
 * `POST /tenants/:tenantSlug/members/me/leave` — the member leaves the tenant (also while their
 * membership or the tenant is suspended). Asks once, then returns to the app root, which opens
 * another of the member's tenants or onboarding. The owner never sees it (the API refuses them).
 */
export const LeaveTenantButton = React.forwardRef<HTMLDivElement, LeaveTenantButtonProps>(function LeaveTenantButton({ tenantSlug, tenantName }, ref): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const [confirming, setConfirming] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const leave = api.tenants.leaveTenant.useMutation({
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: apiRouter.tenants.membershipsBootstrap.scopeKey(undefined) });
			router.push(ROUTES.home);
		},
		onError: (caught) => {
			setError(resolveAuthErrorMessage(caught));
		},
	});
	const { mutate: leaveTenant } = leave;

	const handleAsk = React.useCallback((): void => {
		setError(null);
		setConfirming(true);
	}, []);

	const handleCancel = React.useCallback((): void => {
		setConfirming(false);
	}, []);

	const handleLeave = React.useCallback((): void => {
		leaveTenant({ tenantSlug });
	}, [leaveTenant, tenantSlug]);

	return (
		<div ref={ref} className="space-y-2">
			{confirming ? (
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-sm text-foreground">Leave {tenantName}? You lose access to it until someone invites you again.</p>
					<Button type="button" variant="destructive" onClick={handleLeave} disabled={leave.isPending}>
						Leave tenant
					</Button>
					<Button type="button" variant="outline" onClick={handleCancel} disabled={leave.isPending}>
						Stay
					</Button>
				</div>
			) : (
				<Button type="button" variant="outline" onClick={handleAsk}>
					Leave this tenant
				</Button>
			)}
			{error !== null ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
});
