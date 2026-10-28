"use client";

import { AccessExpiry } from "@/contexts/tenancy/components/access/access-parts";
import { ACCESS_DURATION_OPTIONS, AccessDurationSchema, resolveExpiresAt, type AccessDuration } from "@/contexts/tenancy/lib/access/grant-duration";
import { useQueryClient } from "@tanstack/react-query";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_MAX_LIMIT, ShareLevelSchema, type ShareableResource, type ShareLevel, type TenantMemberRosterResponse, type TenantShareResponse } from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

const UNSHARE_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Stop sharing", loading: "Stopping…" };
const LEVEL_OPTIONS: readonly SelectOption<ShareLevel>[] = [
	{ value: "VIEW", label: "Can view" },
	{ value: "EDIT", label: "Can edit" },
];

/** "Can view" / "Can edit". */
export function shareLevelLabel(level: ShareLevel): string {
	return level === "EDIT" ? "Can edit" : "Can view";
}

export interface RecordSharesCardProps {
	readonly tenantSlug: string;
	/** Which kind of record, and which one (ADR 067: one record, one teammate). */
	readonly resource: ShareableResource;
	readonly resourceId: string;
	/** The tenant's zone, for "until a date" and the exact end time. */
	readonly timeZone: string;
}

/**
 * Who this one record is shared with, and a form to share it with one more teammate — to view or to edit,
 * for a while or for good. The API decides: the sharer's own role must give that level on the record.
 */
export function RecordSharesCard({ tenantSlug, resource, resourceId, timeZone }: RecordSharesCardProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const sharesQuery = api.tenantAccess.shares.useQuery({ tenantSlug });
	const membersQuery = api.tenants.listMembers.useQuery({ tenantSlug, page: 1, limit: LIST_MAX_LIMIT });
	const members = React.useMemo((): readonly TenantMemberRosterResponse[] => membersQuery.data?.data ?? [], [membersQuery.data]);
	// Record ids are UUIDs, unique across record types, so the id alone picks this record's shares.
	const shares = (sharesQuery.data?.data ?? []).filter((share) => share.resourceId === resourceId);
	const [toStop, setToStop] = React.useState<TenantShareResponse | null>(null);

	const refresh = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.tenantAccess.shares.scopeKey({ tenantSlug }) });
	}, [queryClient, tenantSlug]);
	const unshareMutation = api.tenantAccess.unshare.useMutation({
		onSuccess: async (): Promise<void> => {
			setToStop(null);
			toastMessage.success({ title: "Stopped sharing" });
			await refresh();
		},
	});

	const nameOf = React.useCallback((membershipId: string): string => members.find((member) => member.id === membershipId)?.fullName ?? "A former teammate", [members]);
	const askStop = React.useCallback(
		(share: TenantShareResponse): void => {
			unshareMutation.reset();
			setToStop(share);
		},
		[unshareMutation],
	);
	const handleDialogChange = React.useCallback((open: boolean): void => {
		if (!open) {
			setToStop(null);
		}
	}, []);
	const confirmStop = React.useCallback((): void => {
		if (toStop !== null) {
			unshareMutation.mutate({ tenantSlug, shareId: toStop.id });
		}
	}, [tenantSlug, toStop, unshareMutation]);

	return (
		<section aria-labelledby="record-shares-heading" className="flex flex-col gap-3">
			<h2 id="record-shares-heading" className="text-base font-semibold text-foreground">
				Shared with
			</h2>
			<Card className="gap-4 p-5 sm:p-6">
				{sharesQuery.isLoading ? (
					<Skeleton aria-label="Loading shares" className="h-14 w-full rounded-lg" />
				) : shares.length === 0 ? (
					<p className="text-sm text-muted-foreground">Not shared with anyone. Share it with one teammate to let them see or edit just this.</p>
				) : (
					<ul className="space-y-3">
						{shares.map((share) => (
							<ShareRow key={share.id} share={share} name={nameOf(share.membershipId)} timeZone={timeZone} onStop={askStop} />
						))}
					</ul>
				)}
				<ShareForm
					tenantSlug={tenantSlug}
					resource={resource}
					resourceId={resourceId}
					timeZone={timeZone}
					members={members.map((member) => ({ value: member.id, label: member.fullName }))}
					membersCapped={readPaginatedTotal(membersQuery.data?.meta, members.length) > LIST_MAX_LIMIT}
					onShared={refresh}
				/>
			</Card>
			<AlertDialog open={toStop !== null} onOpenChange={handleDialogChange}>
				<AlertDialogContent align="start" actionOrder="cancel-first" labels={UNSHARE_LABELS} confirmLoading={unshareMutation.isPending} onConfirm={confirmStop}>
					<AlertDialogTitle>Stop sharing with {toStop === null ? "" : nameOf(toStop.membershipId)}?</AlertDialogTitle>
					<AlertDialogDescription>They lose access to this at once, unless their role gives it to them anyway.</AlertDialogDescription>
					{unshareMutation.error === null ? null : (
						<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{resolveAuthErrorMessage(unshareMutation.error)}
						</p>
					)}
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}

interface ShareRowProps {
	readonly share: TenantShareResponse;
	readonly name: string;
	readonly timeZone: string;
	readonly onStop: (share: TenantShareResponse) => void;
}

function ShareRow({ share, name, timeZone, onStop }: ShareRowProps): React.JSX.Element {
	const handleStop = React.useCallback((): void => {
		onStop(share);
	}, [onStop, share]);
	return (
		<li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0 space-y-1">
				<p className="flex flex-wrap items-center gap-2">
					<span className="font-medium text-foreground">{name}</span>
					<Badge variant="secondary">{shareLevelLabel(share.level)}</Badge>
				</p>
				<AccessExpiry expiresAt={share.expiresAt} timeZone={timeZone} />
			</div>
			<Button type="button" variant="outline" size="sm" onClick={handleStop}>
				Stop sharing
			</Button>
		</li>
	);
}

interface ShareFormProps {
	readonly tenantSlug: string;
	readonly resource: ShareableResource;
	readonly resourceId: string;
	readonly timeZone: string;
	readonly members: readonly SelectOption<string>[];
	/** More teammates than one page lists: say so instead of hiding the rest silently. */
	readonly membersCapped: boolean;
	readonly onShared: () => Promise<void>;
}

function ShareForm({ tenantSlug, resource, resourceId, timeZone, members, membersCapped, onShared }: ShareFormProps): React.JSX.Element {
	const { api } = useAuth();
	const [membershipId, setMembershipId] = React.useState<string>("");
	const [level, setLevel] = React.useState<ShareLevel>("VIEW");
	const [duration, setDuration] = React.useState<AccessDuration>("7d");
	const [untilDate, setUntilDate] = React.useState<string>("");
	const [error, setError] = React.useState<string | null>(null);

	const shareMutation = api.tenantAccess.share.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Shared" });
			setMembershipId("");
			setError(null);
			await onShared();
		},
		onError: (mutationError): void => {
			setError(resolveAuthErrorMessage(mutationError));
		},
	});

	const handleMember = React.useCallback((value: string | null): void => {
		setMembershipId(value ?? "");
	}, []);
	const handleLevel = React.useCallback((value: string | null): void => {
		const parsed = ShareLevelSchema.safeParse(value);
		if (parsed.success) {
			setLevel(parsed.data);
		}
	}, []);
	const handleDuration = React.useCallback((value: string | null): void => {
		const parsed = AccessDurationSchema.safeParse(value);
		if (parsed.success) {
			setDuration(parsed.data);
		}
	}, []);
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (membershipId === "") {
				setError("Choose who to share it with.");
				return;
			}
			const expiry = resolveExpiresAt(duration, Date.now(), untilDate, timeZone);
			if (!expiry.ok) {
				setError(expiry.message);
				return;
			}
			setError(null);
			shareMutation.mutate({ tenantSlug, resource, resourceId, membershipId, level, ...(expiry.expiresAt === undefined ? {} : { expiresAt: expiry.expiresAt }) });
		},
		[duration, level, membershipId, resource, resourceId, shareMutation, tenantSlug, timeZone, untilDate],
	);

	return (
		<form className="space-y-4 rounded-xl border border-border bg-background/60 p-4" onSubmit={handleSubmit} noValidate>
			<h3 className="text-sm font-semibold text-foreground">Share with a teammate</h3>
			<div className="grid gap-4 sm:grid-cols-3">
				<div className="space-y-2">
					<Label htmlFor="share-member">Teammate</Label>
					<Select items={members} value={membershipId === "" ? null : membershipId} onValueChange={handleMember} disabled={shareMutation.isPending}>
						<SelectTrigger id="share-member">
							<SelectValue placeholder="Choose a teammate" />
						</SelectTrigger>
						<SelectContent>
							{members.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{membersCapped ? <p className="text-xs text-muted-foreground">Showing the first {String(LIST_MAX_LIMIT)} teammates.</p> : null}
				</div>
				<div className="space-y-2">
					<Label htmlFor="share-level">Access</Label>
					<Select items={LEVEL_OPTIONS} value={level} onValueChange={handleLevel} disabled={shareMutation.isPending}>
						<SelectTrigger id="share-level">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LEVEL_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="share-duration">For how long</Label>
					<Select items={ACCESS_DURATION_OPTIONS} value={duration} onValueChange={handleDuration} disabled={shareMutation.isPending}>
						<SelectTrigger id="share-duration">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ACCESS_DURATION_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
			{duration === "custom" ? (
				<div className="max-w-xs space-y-2">
					<Label htmlFor="share-until">Last day</Label>
					<DatePicker id="share-until" value={untilDate} onValueChange={setUntilDate} placeholder="Pick a date" disabled={shareMutation.isPending} />
				</div>
			) : null}
			{error === null ? null : (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
			<Button type="submit" disabled={shareMutation.isPending}>
				{shareMutation.isPending ? "Sharing…" : "Share"}
			</Button>
		</form>
	);
}
