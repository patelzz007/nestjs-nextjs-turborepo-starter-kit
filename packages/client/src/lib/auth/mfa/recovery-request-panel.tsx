"use client";

import { resolveAuthErrorMessage } from "../errors";
import { useAuth } from "../index";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { Textarea } from "@workspace/ui/components/textarea";
import { useCallback, useState, type JSX } from "react";
import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { catchCaught } from "../../caught";

/** What the panel announces while it learns whether two-factor authentication is on. */
export const MFA_RECOVERY_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading MFA recovery…" };
/** What the status box announces while the current request loads. */
export const MFA_RECOVERY_STATUS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading your recovery request…" };

/** The status box's silhouette: the status, its message and the scheduled-unlock line. */
function RecoveryStatusSkeleton(): JSX.Element {
	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-muted/20 px-4 py-3">
			<Skeleton variant="text" className="h-4 w-56 max-w-full" />
			<Skeleton variant="text" className="h-3.5 w-80 max-w-full" />
		</div>
	);
}

/** The enrolled panel's silhouette: heading, explanation, status box, reason field and the request button. */
function RecoveryPanelSkeleton(): JSX.Element {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Skeleton variant="text" className="h-4 w-56 max-w-full" />
				<Skeleton variant="text" className="h-3.5 w-full" />
				<Skeleton variant="text" className="h-3.5 w-2/3" />
			</div>
			<RecoveryStatusSkeleton />
			<div className="flex flex-col gap-2">
				<Skeleton variant="text" className="h-3.5 w-48" />
				<Skeleton className="h-20 w-full" />
			</div>
			<Skeleton className="h-9 w-44" />
		</div>
	);
}

/** The same text on the server and in the browser: an explicit locale + time zone, never the runtime's defaults. */
function formatDateTime(ms: number): string {
	return formatEpochMs(ms, "dateTime", PLATFORM_DISPLAY_REGION);
}

function formatRecoveryStatus(status: string): string {
	if (status === "NONE") {
		return "No active request";
	}
	if (status === "PENDING") {
		return "Pending administrator review";
	}
	if (status === "APPROVED") {
		return "Approved — MFA will be cleared after the security delay";
	}
	if (status === "DENIED") {
		return "Denied";
	}
	if (status === "COMPLETED") {
		return "Completed — you can enroll a new authenticator";
	}
	return status;
}

export function MfaRecoveryRequestPanel(): JSX.Element {
	const { api } = useAuth();
	const meQuery = api.auth.me.useQuery(undefined, { retry: 1 });
	const statusQuery = api.auth.mfaRecoveryStatus.useQuery(undefined, { retry: 1 });
	const initiateMutation = api.auth.mfaRecoveryInitiate.useMutation();
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const twoFactorEnabled: boolean = meQuery.data?.data.twoFactorEnabled === true;
	const recoveryStatus = statusQuery.data?.data;

	const handleReasonChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setReason(event.target.value);
	}, []);

	const handleSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			setMessage(null);
			void catchCaught(
				initiateMutation.mutateAsync({ reason: reason.trim().length > 0 ? reason.trim() : undefined }).then((response): void => {
					setMessage(response.data.message);
					setReason("");
					void statusQuery.refetch();
				}),
				(err): void => {
					setError(resolveAuthErrorMessage(err));
				},
			);
		},
		[initiateMutation, reason, statusQuery],
	);

	// Until the account answers, "not enrolled" would be a guess — draw the panel's shape instead.
	if (meQuery.isPending) {
		return (
			<SkeletonRegion labels={MFA_RECOVERY_LOADING_LABELS}>
				<RecoveryPanelSkeleton />
			</SkeletonRegion>
		);
	}

	if (!twoFactorEnabled) {
		return (
			<div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">MFA recovery is available after you enroll in two-factor authentication.</div>
		);
	}

	const canInitiate: boolean = recoveryStatus === undefined || recoveryStatus.status === "NONE" || recoveryStatus.status === "DENIED" || recoveryStatus.status === "COMPLETED";

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-sm font-semibold">Lost access to your authenticator?</h3>
				<p className="text-sm text-muted-foreground">
					If you no longer have your authenticator app or backup codes, request an administrator-reviewed recovery. MFA is cleared only after a security delay.
				</p>
			</div>

			{statusQuery.isPending ? (
				<SkeletonRegion labels={MFA_RECOVERY_STATUS_LOADING_LABELS}>
					<RecoveryStatusSkeleton />
				</SkeletonRegion>
			) : null}

			{recoveryStatus !== undefined ? (
				<div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
					<p className="font-medium text-foreground">{formatRecoveryStatus(recoveryStatus.status)}</p>
					<p className="mt-1 text-muted-foreground">{recoveryStatus.message}</p>
					{recoveryStatus.scheduledUnlockAt !== undefined ? (
						<p className="mt-2 text-xs text-muted-foreground">Scheduled unlock: {formatDateTime(recoveryStatus.scheduledUnlockAt)}</p>
					) : null}
				</div>
			) : null}

			{error ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
			{message ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{message}</div> : null}

			{canInitiate ? (
				<form className="space-y-3" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="recovery-reason">Why you need help (optional)</Label>
						<Textarea id="recovery-reason" value={reason} onChange={handleReasonChange} placeholder="e.g. Lost phone with authenticator app" rows={3} />
					</div>
					<Button type="submit" variant="outline" loading={initiateMutation.isPending}>
						Request MFA recovery
					</Button>
				</form>
			) : null}
		</div>
	);
}
