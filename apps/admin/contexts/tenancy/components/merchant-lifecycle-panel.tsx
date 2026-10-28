"use client";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { Can } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { PERMISSION, TENANT_LIFECYCLE_TEXT_MAX_LENGTH, type CapabilitySlug, type TenantLifecycleResponse, type TenantSuspensionAppealResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { toastMessage } from "@workspace/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { TENANT_APPEAL_STATUS_LABELS, TENANT_LIFECYCLE_STATE_LABELS } from "@/lib/data-table/enum-filter-options";
import { formatDateTime } from "@/lib/format/dates";
import { useSuperAdminStatus } from "@/lib/session/super-admin";

/** What a platform admin may do to the tenant in its current state. */
export type MerchantLifecycleAction = "suspend" | "reinstate" | null;

/** Suspension starts from ACTIVE or RESTRICTED; reinstatement from SUSPENDED (the API enforces the same table). */
export function lifecycleActionFor(state: TenantLifecycleResponse["lifecycleState"]): MerchantLifecycleAction {
	if (state === "ACTIVE" || state === "RESTRICTED") {
		return "suspend";
	}
	return state === "SUSPENDED" ? "reinstate" : null;
}

/** What a super admin may do about a ban in the tenant's current state. */
export type MerchantBanAction = "ban" | "unban" | null;

/** A live tenant (active, restricted or suspended) can be banned; a banned one can have its ban lifted (the API enforces the same table). */
export function banActionFor(state: TenantLifecycleResponse["lifecycleState"]): MerchantBanAction {
	if (state === "ACTIVE" || state === "RESTRICTED" || state === "SUSPENDED") {
		return "ban";
	}
	return state === "BANNED" ? "unban" : null;
}

const BAN_COPY: Readonly<Record<Exclude<MerchantBanAction, null>, { readonly label: string; readonly field: string; readonly success: string }>> = {
	ban: {
		label: "Ban merchant",
		field: "Why is this merchant banned? Unlike a suspension, the merchant cannot appeal, and its pending appeal is closed.",
		success: "Merchant banned",
	},
	unban: { label: "Lift ban", field: "Why is the ban lifted? The merchant is active again.", success: "Ban lifted" },
};

const ACTION_COPY: Readonly<Record<Exclude<MerchantLifecycleAction, null>, { readonly label: string; readonly field: string; readonly success: string }>> = {
	suspend: { label: "Suspend merchant", field: "Why is this merchant suspended?", success: "Merchant suspended" },
	reinstate: { label: "Reinstate merchant", field: "Why is this merchant reinstated? (the merchant's pending appeal gets this answer)", success: "Merchant reinstated" },
};

/** The permission each lifecycle action's route requires (`POST /admin/merchants/:id/{suspend,reinstate}`). */
const ACTION_PERMISSION: Readonly<Record<Exclude<MerchantLifecycleAction, null>, CapabilitySlug>> = {
	suspend: PERMISSION.MERCHANT_ORG.SUSPEND,
	reinstate: PERMISSION.MERCHANT_ORG.REACTIVATE,
};

interface AppealRowProps {
	readonly tenantId: string;
	readonly appeal: TenantSuspensionAppealResponse;
}

/** One appeal; a pending one can be rejected with a note (accepting it is reinstating the merchant). */
function AppealRow({ tenantId, appeal }: AppealRowProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [note, setNote] = React.useState("");
	const reject = api.rewardsAdmin.rejectTenantAppeal.useMutation({
		onSuccess: async () => {
			setNote("");
			await queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.getTenantLifecycle.scopeKey({ tenantId }) });
			toastMessage.success({ title: "Appeal rejected" });
		},
		onError: (error) => {
			toastMutationError("Could not reject the appeal", error);
		},
	});
	const { mutate: rejectAppeal } = reject;

	const handleNoteChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setNote(event.target.value);
	}, []);

	const handleReject = React.useCallback((): void => {
		rejectAppeal({ tenantId, appealId: appeal.id, note: note.trim() });
	}, [appeal.id, note, rejectAppeal, tenantId]);

	return (
		<li className="space-y-2 rounded-lg border p-4" data-appeal-status={appeal.status}>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm font-medium text-foreground">
					{appeal.submittedBy?.fullName ?? "Former member"} · {formatDateTime(appeal.createdAt)}
				</p>
				<Badge variant={appeal.status === "PENDING" ? "secondary" : "outline"}>{TENANT_APPEAL_STATUS_LABELS[appeal.status]}</Badge>
			</div>
			<p className="text-sm whitespace-pre-wrap text-foreground">{appeal.message}</p>
			{appeal.reviewNote !== null ? (
				<p className="text-sm text-muted-foreground">
					Answer{appeal.reviewedAt === null ? "" : ` (${formatDateTime(appeal.reviewedAt)})`}: {appeal.reviewNote}
				</p>
			) : null}
			{appeal.status === "PENDING" ? (
				<Can permission={PERMISSION.MERCHANT_ORG.REJECT}>
					<div className="space-y-2">
						<Label htmlFor={`appeal-note-${appeal.id}`}>Rejection note</Label>
						<Textarea id={`appeal-note-${appeal.id}`} value={note} onChange={handleNoteChange} maxLength={TENANT_LIFECYCLE_TEXT_MAX_LENGTH} />
						<Button type="button" variant="outline" onClick={handleReject} disabled={reject.isPending || note.trim().length === 0}>
							Reject appeal
						</Button>
					</div>
				</Can>
			) : null}
		</li>
	);
}

interface MerchantBanSectionProps {
	readonly tenantId: string;
	readonly action: Exclude<MerchantBanAction, null>;
	readonly onDone: (title: string) => Promise<void>;
}

/** The super admin's ban / lift-ban control: a reason, then the action (the API refuses anyone else). */
function MerchantBanSection({ tenantId, action, onDone }: MerchantBanSectionProps): React.JSX.Element {
	const { api } = useAuth();
	const [reason, setReason] = React.useState("");
	const onSuccess = React.useCallback(async (): Promise<void> => {
		setReason("");
		await onDone(BAN_COPY[action].success);
	}, [action, onDone]);
	const ban = api.rewardsAdmin.banTenant.useMutation({
		onSuccess,
		onError: (error) => {
			toastMutationError("Could not ban the merchant", error);
		},
	});
	const unban = api.rewardsAdmin.unbanTenant.useMutation({
		onSuccess,
		onError: (error) => {
			toastMutationError("Could not lift the ban", error);
		},
	});
	const { mutate: banTenant } = ban;
	const { mutate: unbanTenant } = unban;

	const handleReasonChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setReason(event.target.value);
	}, []);
	const handleAction = React.useCallback((): void => {
		const input = { tenantId, reason: reason.trim() };
		if (action === "ban") {
			banTenant(input);
		} else {
			unbanTenant(input);
		}
	}, [action, banTenant, reason, tenantId, unbanTenant]);

	return (
		<section className="space-y-2 border-t pt-6">
			<h3 className="text-sm font-semibold text-foreground">Ban (super admin)</h3>
			<Label htmlFor="merchant-ban-reason">{BAN_COPY[action].field}</Label>
			<Textarea id="merchant-ban-reason" value={reason} onChange={handleReasonChange} maxLength={TENANT_LIFECYCLE_TEXT_MAX_LENGTH} />
			<Button
				type="button"
				variant={action === "ban" ? "destructive" : "default"}
				onClick={handleAction}
				disabled={ban.isPending || unban.isPending || reason.trim().length === 0}>
				{BAN_COPY[action].label}
			</Button>
		</section>
	);
}

export interface MerchantLifecyclePanelProps {
	readonly lifecycle: TenantLifecycleResponse;
}

/**
 * The merchant's lifecycle: its state, current suspension or ban, the suspend / reinstate action its
 * state allows (`SUSPEND` / `REACTIVATE MERCHANT_ORG`), the ban / lift-ban action (super admin only), and its
 * suspension appeals.
 */
export const MerchantLifecyclePanel = React.forwardRef<HTMLDivElement, MerchantLifecyclePanelProps>(function MerchantLifecyclePanel({ lifecycle }, ref): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [reason, setReason] = React.useState("");
	const action = lifecycleActionFor(lifecycle.lifecycleState);
	const banAction = banActionFor(lifecycle.lifecycleState);
	const { isSuperAdmin } = useSuperAdminStatus();

	const refresh = React.useCallback(
		async (title: string): Promise<void> => {
			setReason("");
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.getTenantLifecycle.scopeKey({ tenantId: lifecycle.tenantId }) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.getTenant.scopeKey({ tenantId: lifecycle.tenantId }) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.listTenants.scopeKey(undefined) }),
			]);
			toastMessage.success({ title });
		},
		[lifecycle.tenantId, queryClient],
	);
	const suspend = api.rewardsAdmin.suspendTenant.useMutation({
		onSuccess: () => refresh(ACTION_COPY.suspend.success),
		onError: (error) => {
			toastMutationError("Could not suspend the merchant", error);
		},
	});
	const reinstate = api.rewardsAdmin.reinstateTenant.useMutation({
		onSuccess: () => refresh(ACTION_COPY.reinstate.success),
		onError: (error) => {
			toastMutationError("Could not reinstate the merchant", error);
		},
	});
	const { mutate: suspendTenant } = suspend;
	const { mutate: reinstateTenant } = reinstate;
	const isPending = suspend.isPending || reinstate.isPending;

	const handleReasonChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setReason(event.target.value);
	}, []);

	const handleAction = React.useCallback((): void => {
		const input = { tenantId: lifecycle.tenantId, reason: reason.trim() };
		if (action === "suspend") {
			suspendTenant(input);
		} else if (action === "reinstate") {
			reinstateTenant(input);
		}
	}, [action, lifecycle.tenantId, reason, reinstateTenant, suspendTenant]);

	return (
		<div ref={ref}>
			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<CardTitle className="text-lg">Lifecycle</CardTitle>
						<Badge variant={lifecycle.lifecycleState === "ACTIVE" ? "default" : "secondary"}>{TENANT_LIFECYCLE_STATE_LABELS[lifecycle.lifecycleState]}</Badge>
					</div>
					<CardDescription>
						A suspended merchant keeps only its lifecycle pages: it can read its status and appeal, nothing else. A banned merchant cannot appeal, and its rewards leave the
						marketplace.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{lifecycle.suspension !== null ? (
						<p className="text-sm text-foreground">
							Suspended {formatDateTime(lifecycle.suspension.suspendedAt)}
							{lifecycle.suspension.reason === null ? "" : `: ${lifecycle.suspension.reason}`}
						</p>
					) : null}
					{lifecycle.ban !== null ? (
						<p className="text-sm text-foreground">
							Banned {formatDateTime(lifecycle.ban.bannedAt)}
							{lifecycle.ban.reason === null ? "" : `: ${lifecycle.ban.reason}`}
						</p>
					) : null}
					{lifecycle.deletionGraceEndsAt !== null ? (
						<p className="text-sm text-muted-foreground">The owner can cancel the deletion until {formatDateTime(lifecycle.deletionGraceEndsAt)}.</p>
					) : null}

					{action !== null ? (
						<Can permission={ACTION_PERMISSION[action]}>
							<div className="space-y-2">
								<Label htmlFor="merchant-lifecycle-reason">{ACTION_COPY[action].field}</Label>
								<Textarea id="merchant-lifecycle-reason" value={reason} onChange={handleReasonChange} maxLength={TENANT_LIFECYCLE_TEXT_MAX_LENGTH} />
								<Button type="button" variant={action === "suspend" ? "destructive" : "default"} onClick={handleAction} disabled={isPending || reason.trim().length === 0}>
									{ACTION_COPY[action].label}
								</Button>
							</div>
						</Can>
					) : null}

					{banAction !== null && isSuperAdmin ? <MerchantBanSection key={banAction} tenantId={lifecycle.tenantId} action={banAction} onDone={refresh} /> : null}

					<section className="space-y-3">
						<h3 className="text-sm font-semibold text-foreground">Appeals</h3>
						{lifecycle.appeals.length === 0 ? (
							<p className="text-sm text-muted-foreground">No appeals.</p>
						) : (
							<ul className="space-y-3">
								{lifecycle.appeals.map((appeal) => (
									<AppealRow key={appeal.id} tenantId={lifecycle.tenantId} appeal={appeal} />
								))}
							</ul>
						)}
					</section>
				</CardContent>
			</Card>
		</div>
	);
});
