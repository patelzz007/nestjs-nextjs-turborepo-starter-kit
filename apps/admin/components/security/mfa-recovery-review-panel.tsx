"use client";

import type { AdminMfaRecoveryRequest } from "@workspace/shared";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/auth-errors";
import { useAuth } from "@workspace/client/lib/auth";
import { formatDateTimeWithSeconds } from "@/lib/dates";
import { MfaRecoveryStatusBadge } from "@/components/security/mfa-recovery-status-badge";
import { Button } from "@workspace/ui/components/form/button";
import { Label } from "@workspace/ui/components/form/label";
import { Textarea } from "@workspace/ui/components/form/textarea";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

export interface MfaRecoveryReviewPanelProps {
	readonly request: AdminMfaRecoveryRequest;
	readonly onReviewed?: () => void;
}

export const MfaRecoveryReviewPanel = React.forwardRef<HTMLDivElement, MfaRecoveryReviewPanelProps>(function MfaRecoveryReviewPanel(
	{ request, onReviewed },
	ref,
): React.JSX.Element {
	const { api, user: currentUser } = useAuth();
	const queryClient = useQueryClient();
	const reviewMutation = api.auth.adminMfaRecoveryReview.useMutation();
	const [notes, setNotes] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);
	const [message, setMessage] = React.useState<string | null>(null);

	const canReview: boolean = currentUser?.isSuperAdmin === true && request.status === "PENDING";

	const handleNotesChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setNotes(event.target.value);
	}, []);

	const invalidateRecoveryQueries = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: ["auth", "admin-mfa-recovery-requests"] });
		await queryClient.invalidateQueries({ queryKey: ["auth", "admin-user", request.userId] });
	}, [queryClient, request.userId]);

	const handleReview = React.useCallback(
		(action: "approve" | "deny"): void => {
			setError(null);
			setMessage(null);
			reviewMutation
				.mutateAsync({
					requestId: request.id,
					action,
					notes: notes.trim().length > 0 ? notes.trim() : undefined,
				})
				.then(async (response): Promise<void> => {
					setMessage(response.data.message);
					setNotes("");
					await invalidateRecoveryQueries();
					onReviewed?.();
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[invalidateRecoveryQueries, notes, onReviewed, request.id, reviewMutation],
	);

	const handleApprove = React.useCallback((): void => {
		handleReview("approve");
	}, [handleReview]);

	const handleDeny = React.useCallback((): void => {
		handleReview("deny");
	}, [handleReview]);

	return (
		<div ref={ref} className="space-y-4 rounded-lg border bg-muted/20 p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p className="text-sm font-medium text-foreground">{request.userFullName}</p>
					<p className="text-xs text-muted-foreground">{request.userEmail}</p>
				</div>
				<MfaRecoveryStatusBadge status={request.status} />
			</div>

			<dl className="grid gap-3 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Requested</dt>
					<dd>{formatDateTimeWithSeconds(request.requestedAt)}</dd>
				</div>
				{request.reviewedAt !== null ? (
					<div>
						<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reviewed</dt>
						<dd>{formatDateTimeWithSeconds(request.reviewedAt)}</dd>
					</div>
				) : null}
				{request.scheduledUnlockAt !== null ? (
					<div>
						<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">MFA clears after</dt>
						<dd>{formatDateTimeWithSeconds(request.scheduledUnlockAt)}</dd>
					</div>
				) : null}
				{request.completedAt !== null ? (
					<div>
						<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Completed</dt>
						<dd>{formatDateTimeWithSeconds(request.completedAt)}</dd>
					</div>
				) : null}
			</dl>

			{request.notes !== null && request.notes.length > 0 ? (
				<div className="rounded-md border bg-background px-3 py-2 text-sm">
					<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">User reason</p>
					<p className="mt-1 whitespace-pre-wrap text-foreground">{request.notes}</p>
				</div>
			) : null}

			{error ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
			{message ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">{message}</div> : null}

			{canReview ? (
				<div className="space-y-3 border-t pt-4">
					<div className="space-y-2">
						<Label htmlFor={`review-notes-${request.id}`}>Review notes (optional)</Label>
						<Textarea id={`review-notes-${request.id}`} value={notes} onChange={handleNotesChange} placeholder="Internal notes for the audit trail" rows={3} />
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
						<Button type="button" variant="outline" loading={reviewMutation.isPending} onClick={handleDeny}>
							Deny request
						</Button>
						<Button type="button" loading={reviewMutation.isPending} onClick={handleApprove}>
							Approve recovery
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">Approved requests clear MFA after the configured security delay. The user must set up a new authenticator afterward.</p>
				</div>
			) : currentUser?.isSuperAdmin !== true ? (
				<p className="text-xs text-muted-foreground">Only super administrators can approve or deny MFA recovery requests.</p>
			) : null}
		</div>
	);
});
