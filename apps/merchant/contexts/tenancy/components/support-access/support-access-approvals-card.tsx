"use client";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { PLATFORM_DISPLAY_REGION, type SupportAccessGrantDetail } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useActiveMembership } from "@/features/tenant-context/facade";

/** The grants waiting for the owner's approval. */
export function pendingApprovals(grants: readonly SupportAccessGrantDetail[]): readonly SupportAccessGrantDetail[] {
	return grants.filter((grant) => grant.status === "PENDING_TENANT_APPROVAL");
}

interface ApprovalRowProps {
	readonly grant: SupportAccessGrantDetail;
	readonly onApprove: (grantId: string) => void;
	readonly isPending: boolean;
}

function ApprovalRow({ grant, onApprove, isPending }: ApprovalRowProps): React.JSX.Element {
	const handleApprove = React.useCallback((): void => {
		onApprove(grant.id);
	}, [grant.id, onApprove]);
	return (
		<li className="space-y-2 rounded-lg border p-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm font-medium text-foreground">{grant.supportUser?.fullName ?? "Platform support"}</p>
				<Badge variant="secondary">{grant.mode === "READ_ONLY" ? "Read only" : "Read and write"}</Badge>
			</div>
			<p className="text-sm whitespace-pre-wrap text-foreground">{grant.reason}</p>
			<p className="text-xs text-muted-foreground">
				{grant.ticketRef === null ? "" : `Ticket ${grant.ticketRef} · `}Expires {formatEpochMs(grant.expiresAt, "dateTime", PLATFORM_DISPLAY_REGION)}
			</p>
			<Button type="button" size="sm" onClick={handleApprove} disabled={isPending}>
				Approve access
			</Button>
		</li>
	);
}

export interface SupportAccessApprovalsCardProps {
	readonly tenantSlug: string;
}

/**
 * The owner's side of support access: platform support asks for time-boxed access to this tenant,
 * and nothing works until the owner approves it here. Shown to the owner only (the API checks it too).
 */
export const SupportAccessApprovalsCard = React.forwardRef<HTMLDivElement, SupportAccessApprovalsCardProps>(function SupportAccessApprovalsCard(
	{ tenantSlug },
	ref,
): React.JSX.Element | null {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const { membership } = useActiveMembership();
	const isOwner = membership?.role === "OWNER";
	const grantsQuery = api.supportAccess.tenantList.useQuery({ tenantSlug }, { enabled: isOwner });
	const [error, setError] = React.useState<string | null>(null);
	const approve = api.supportAccess.approve.useMutation({
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: apiRouter.supportAccess.tenantList.scopeKey({ tenantSlug }) });
		},
		onError: (caught) => {
			setError(resolveAuthErrorMessage(caught));
		},
	});
	const { mutate: approveGrant } = approve;
	const handleApprove = React.useCallback(
		(grantId: string): void => {
			setError(null);
			approveGrant({ grantId });
		},
		[approveGrant],
	);

	if (!isOwner) {
		return null;
	}
	const waiting = pendingApprovals(grantsQuery.data?.data ?? []);

	return (
		<div ref={ref} className="rounded-xl border bg-card p-4">
			<div className="space-y-3">
				<div className="space-y-1">
					<p className="font-medium">Support access</p>
					<p className="text-sm text-muted-foreground">Platform support may ask for time-boxed access to help with a case. It works only after you approve it.</p>
				</div>
				{waiting.length === 0 ? (
					<p className="text-sm text-muted-foreground">No requests are waiting for you.</p>
				) : (
					<ul className="space-y-3">
						{waiting.map((grant) => (
							<ApprovalRow key={grant.id} grant={grant} onApprove={handleApprove} isPending={approve.isPending} />
						))}
					</ul>
				)}
				{error !== null ? (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				) : null}
			</div>
		</div>
	);
});
