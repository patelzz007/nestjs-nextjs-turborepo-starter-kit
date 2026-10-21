"use client";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	PLATFORM_DISPLAY_REGION,
	TENANT_LIFECYCLE_TEXT_MAX_LENGTH,
	type TenantAppealStatus,
	type TenantLifecycleResponse,
	type TenantRewardMembershipResponse,
} from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { MerchantAccessLoading } from "../access/merchant-capability-gate";
import { LeaveTenantButton } from "./leave-tenant-button";

/** Lifecycle states the merchant shell replaces every page with this screen for. */
export type TenantLifecycleScreenState = Extract<TenantRewardMembershipResponse["lifecycleState"], "SUSPENDED" | "BANNED" | "PENDING_DELETION">;

/** The state that takes over the shell, or `null` for a tenant whose ordinary pages work. */
export function lifecycleScreenStateOf(membership: TenantRewardMembershipResponse | undefined): TenantLifecycleScreenState | null {
	const state = membership?.lifecycleState;
	return state === "SUSPENDED" || state === "BANNED" || state === "PENDING_DELETION" ? state : null;
}

const APPEAL_STATUS_COPY: Readonly<Record<TenantAppealStatus, string>> = {
	PENDING: "Waiting for review",
	ACCEPTED: "Accepted",
	REJECTED: "Rejected",
};

function formatWhen(epochMs: number): string {
	return formatEpochMs(epochMs, "dateTime", PLATFORM_DISPLAY_REGION);
}

/** The screen's heading for the tenant's state. */
function lifecycleTitle(displayName: string, lifecycle: TenantLifecycleResponse): string {
	switch (lifecycle.lifecycleState) {
		case "SUSPENDED":
			return `${displayName} is suspended`;
		case "BANNED":
			return `${displayName} is banned`;
		default:
			return `${displayName} is pending deletion`;
	}
}

/** What the state means for the tenant's members. */
function lifecycleDescription(lifecycle: TenantLifecycleResponse): string {
	if (lifecycle.lifecycleState === "SUSPENDED") {
		return "The platform suspended this tenant: rewards, redemptions and the rest of the portal are paused until it is reinstated.";
	}
	if (lifecycle.lifecycleState === "BANNED") {
		return "The platform banned this tenant: its rewards are no longer offered to customers and the rest of the portal is closed.";
	}
	return lifecycle.deletionGraceEndsAt === null
		? "The owner asked for this tenant to be deleted."
		: `The owner asked for this tenant to be deleted. It can be reactivated until ${formatWhen(lifecycle.deletionGraceEndsAt)}.`;
}

export interface TenantLifecycleScreenProps {
	readonly membership: TenantRewardMembershipResponse;
}

/**
 * What a member of a suspended, banned or pending-deletion tenant sees instead of the portal: the
 * tenant's state from `GET /tenants/:tenantSlug/lifecycle`, the owner's appeal (suspended) or
 * cancel-deletion (pending deletion) action — a ban has neither — and "leave this tenant" for
 * everyone else. Every call here is a lifecycle route, so it works in exactly these states.
 */
export const TenantLifecycleScreen = React.forwardRef<HTMLDivElement, TenantLifecycleScreenProps>(function TenantLifecycleScreen({ membership }, ref): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const tenantSlug = membership.tenantSlug;
	const isOwner = membership.role === "OWNER";
	const lifecycleQuery = api.tenants.lifecycle.useQuery({ tenantSlug });
	const lifecycle = lifecycleQuery.data?.data;
	const [message, setMessage] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	const refresh = React.useCallback(async (): Promise<void> => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: apiRouter.tenants.lifecycle.scopeKey({ tenantSlug }) }),
			queryClient.invalidateQueries({ queryKey: apiRouter.tenants.membershipsBootstrap.scopeKey(undefined) }),
		]);
	}, [queryClient, tenantSlug]);
	const onError = React.useCallback((caught: Error): void => {
		setError(resolveAuthErrorMessage(caught));
	}, []);
	const appeal = api.tenants.submitAppeal.useMutation({
		onSuccess: async () => {
			setMessage("");
			await refresh();
		},
		onError,
	});
	const reactivate = api.tenants.reactivate.useMutation({ onSuccess: refresh, onError });
	const { mutate: submitAppeal } = appeal;
	const { mutate: reactivateTenant } = reactivate;

	const handleMessageChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setMessage(event.target.value);
	}, []);
	const handleAppeal = React.useCallback((): void => {
		setError(null);
		submitAppeal({ tenantSlug, message: message.trim() });
	}, [message, submitAppeal, tenantSlug]);
	const handleReactivate = React.useCallback((): void => {
		setError(null);
		reactivateTenant({ tenantSlug });
	}, [reactivateTenant, tenantSlug]);

	if (lifecycle === undefined) {
		return lifecycleQuery.isError ? (
			<p role="alert" className="text-sm text-destructive">
				{resolveAuthErrorMessage(lifecycleQuery.error)}
			</p>
		) : (
			<MerchantAccessLoading />
		);
	}

	const suspended = lifecycle.lifecycleState === "SUSPENDED";
	const banned = lifecycle.lifecycleState === "BANNED";
	const pendingDeletion = lifecycle.lifecycleState === "PENDING_DELETION";
	const hasPendingAppeal = lifecycle.appeals.some((candidate) => candidate.status === "PENDING");

	return (
		<div ref={ref} className="mx-auto w-full max-w-3xl space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">{lifecycleTitle(membership.displayName, lifecycle)}</CardTitle>
					<CardDescription>{lifecycleDescription(lifecycle)}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{lifecycle.suspension !== null && lifecycle.suspension.reason !== null ? <p className="text-sm text-foreground">Reason: {lifecycle.suspension.reason}</p> : null}
					{lifecycle.ban !== null && lifecycle.ban.reason !== null ? <p className="text-sm text-foreground">Reason: {lifecycle.ban.reason}</p> : null}

					{suspended && isOwner && !hasPendingAppeal ? (
						<div className="space-y-2">
							<Label htmlFor="tenant-appeal-message">Appeal the suspension</Label>
							<Textarea
								id="tenant-appeal-message"
								value={message}
								onChange={handleMessageChange}
								maxLength={TENANT_LIFECYCLE_TEXT_MAX_LENGTH}
								placeholder="Tell the platform what changed and why the tenant should be reinstated."
							/>
							<Button type="button" onClick={handleAppeal} disabled={appeal.isPending || message.trim().length === 0}>
								Send appeal
							</Button>
						</div>
					) : null}
					{suspended && isOwner && hasPendingAppeal ? <p className="text-sm text-muted-foreground">Your appeal is waiting for review.</p> : null}
					{suspended && !isOwner ? <p className="text-sm text-muted-foreground">Only the tenant owner can appeal.</p> : null}

					{pendingDeletion && isOwner ? (
						<Button type="button" onClick={handleReactivate} disabled={reactivate.isPending}>
							Cancel the deletion
						</Button>
					) : null}

					{banned && isOwner ? <p className="text-sm text-muted-foreground">A ban cannot be appealed here. Contact platform support if you believe it is a mistake.</p> : null}

					{!isOwner ? <LeaveTenantButton tenantSlug={tenantSlug} tenantName={membership.displayName} /> : null}

					{error !== null ? (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					) : null}
				</CardContent>
			</Card>

			{lifecycle.appeals.length > 0 ? (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Appeals</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="space-y-3">
							{lifecycle.appeals.map((item) => (
								<li key={item.id} className="space-y-1 rounded-lg border p-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="text-xs text-muted-foreground">{formatWhen(item.createdAt)}</p>
										<Badge variant={item.status === "PENDING" ? "secondary" : "outline"}>{APPEAL_STATUS_COPY[item.status]}</Badge>
									</div>
									<p className="text-sm whitespace-pre-wrap text-foreground">{item.message}</p>
									{item.reviewNote !== null ? <p className="text-sm text-muted-foreground">Platform answer: {item.reviewNote}</p> : null}
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
});
