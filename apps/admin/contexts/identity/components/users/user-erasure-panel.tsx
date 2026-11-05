"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { ACCOUNT_ERASURE_REASON_MAX_LENGTH, ACCOUNT_ERASURE_REASON_MIN_LENGTH, type AdminUserDetail } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import * as React from "react";

import { resolveUserBanBlocker } from "@/contexts/identity/components/users/user-ban-panel";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { useSuperAdminStatus } from "@/lib/session/super-admin";

export interface UserErasurePanelProps {
	readonly user: AdminUserDetail;
}

/**
 * Support erasing an account for someone who asked another way (ADR 077, Q13): `POST /admin/users/:userId/erasure`
 * with a required reason (in the audit log with the request), the 30-day grace, and cancelling it.
 */
export function UserErasurePanel({ user }: UserErasurePanelProps): React.JSX.Element {
	const { api, user: viewer } = useAuth();
	const { isSuperAdmin } = useSuperAdminStatus();
	const queryClient = useQueryClient();
	const statusQuery = api.adminPrivacy.userErasure.useQuery({ userId: user.id });
	const request = api.adminPrivacy.requestUserErasure.useMutation();
	const cancel = api.adminPrivacy.cancelUserErasure.useMutation();
	const [reason, setReason] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);
	const erasure = statusQuery.data?.data.erasure ?? null;
	const pending = erasure?.status === "PENDING" ? erasure : null;
	const blocker = resolveUserBanBlocker({ id: viewer?.id, isSuperAdmin }, user);
	const trimmed = reason.trim();
	const busy = request.isPending || cancel.isPending;

	const handleReasonChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setReason(event.target.value);
	}, []);
	const run = React.useCallback(
		(work: () => Promise<void>): void => {
			setError(null);
			void (async (): Promise<void> => {
				try {
					await work();
					await queryClient.invalidateQueries({ queryKey: apiRouter.adminPrivacy.userErasure.scopeKey({ userId: user.id }) });
				} catch (caught) {
					setError(resolveAuthErrorMessage(caught instanceof Error ? caught : undefined));
				}
			})();
		},
		[queryClient, user.id],
	);
	const { mutateAsync: requestAsync } = request;
	const { mutateAsync: cancelAsync } = cancel;
	const handleRequest = React.useCallback((): void => {
		run(async (): Promise<void> => {
			await requestAsync({ userId: user.id, reason: trimmed });
			setReason("");
		});
	}, [requestAsync, run, trimmed, user.id]);
	const handleCancel = React.useCallback((): void => {
		run(async (): Promise<void> => {
			await cancelAsync({ userId: user.id });
		});
	}, [cancelAsync, run, user.id]);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">Account erasure</CardTitle>
				<CardDescription>For someone who asked to have their account deleted another way. They are signed out now, and the account is erased 30 days later.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{pending === null ? (
					<p className="text-sm text-muted-foreground">No erasure is pending for this account.</p>
				) : (
					<dl className="grid gap-4 sm:grid-cols-3" data-slot="user-erasure-pending">
						<div className="space-y-1">
							<dt className="text-xs font-medium text-muted-foreground">Erased on</dt>
							<dd className="text-sm text-foreground">{formatDateTimeWithSeconds(pending.scheduledFor)}</dd>
						</div>
						<div className="space-y-1">
							<dt className="text-xs font-medium text-muted-foreground">Asked by</dt>
							<dd className="text-sm text-foreground">{pending.requestedBy === "self" ? "The account holder" : "Support"}</dd>
						</div>
						{pending.reason === null ? null : (
							<div className="space-y-1 sm:col-span-3">
								<dt className="text-xs font-medium text-muted-foreground">Reason</dt>
								<dd className="text-sm whitespace-pre-wrap text-foreground">{pending.reason}</dd>
							</div>
						)}
					</dl>
				)}

				{blocker !== null ? (
					<p className="text-sm text-muted-foreground">
						{blocker === "self" ? "Erase your own account from your own security settings." : "Only a super admin can erase another person's account."}
					</p>
				) : pending === null ? (
					<div className="space-y-2">
						<Label htmlFor="user-erasure-reason">Reason</Label>
						<Textarea
							id="user-erasure-reason"
							value={reason}
							onChange={handleReasonChange}
							maxLength={ACCOUNT_ERASURE_REASON_MAX_LENGTH}
							placeholder="How and when the person asked (for example, the support ticket)."
						/>
						<Button type="button" variant="destructive" onClick={handleRequest} disabled={busy || trimmed.length < ACCOUNT_ERASURE_REASON_MIN_LENGTH}>
							Erase account
						</Button>
					</div>
				) : (
					<Button type="button" variant="outline" onClick={handleCancel} disabled={busy}>
						Cancel the erasure
					</Button>
				)}

				{error === null ? null : (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
