"use client";

import { USER_BAN_REASON_MAX_LENGTH, type AdminUserDetail } from "@workspace/shared";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { useSuperAdminStatus } from "@/lib/session/super-admin";

/** Why the ban control is not offered for this account, or `null` when it is. */
export type UserBanBlocker = "not-super-admin" | "self" | "target-super-admin";

/** UX only — the API refuses each of these cases itself (403 / `USER_BAN_SELF` / `USER_BAN_SUPERADMIN`). */
export function resolveUserBanBlocker(viewer: { readonly id: string | undefined; readonly isSuperAdmin: boolean }, target: AdminUserDetail): UserBanBlocker | null {
	if (!viewer.isSuperAdmin) {
		return "not-super-admin";
	}
	if (viewer.id === target.id) {
		return "self";
	}
	return target.isSuperAdmin ? "target-super-admin" : null;
}

const BLOCKER_COPY: Readonly<Record<UserBanBlocker, string>> = {
	"not-super-admin": "Only a super admin can ban or unban accounts.",
	self: "You cannot ban your own account.",
	"target-super-admin": "A super admin account cannot be banned.",
};

export interface UserBanPanelProps {
	readonly user: AdminUserDetail;
}

/**
 * `POST /auth/admin/users/:userId/ban` and `/unban`: a ban deactivates the account and revokes every
 * session it has; lifting it lets the account sign in again.
 */
export const UserBanPanel = React.forwardRef<HTMLDivElement, UserBanPanelProps>(function UserBanPanel({ user }, ref): React.JSX.Element {
	const { api, user: viewer } = useAuth();
	const { isSuperAdmin } = useSuperAdminStatus();
	const queryClient = useQueryClient();
	const banMutation = api.auth.adminUserBan.useMutation();
	const unbanMutation = api.auth.adminUserUnban.useMutation();
	const [reason, setReason] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	const blocker = resolveUserBanBlocker({ id: viewer?.id, isSuperAdmin }, user);
	const trimmedReason = reason.trim();
	const isPending = banMutation.isPending || unbanMutation.isPending;

	const handleReasonChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setReason(event.target.value);
	}, []);

	const refreshUser = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.auth.adminUserDetail.scopeKey({ userId: user.id }) });
		await queryClient.invalidateQueries({ queryKey: apiRouter.auth.adminUsers.scopeKey(undefined) });
	}, [queryClient, user.id]);

	const run = React.useCallback(
		(work: () => Promise<void>): void => {
			setError(null);
			void (async (): Promise<void> => {
				try {
					await work();
					await refreshUser();
				} catch (caught) {
					setError(resolveAuthErrorMessage(caught instanceof Error ? caught : undefined));
				}
			})();
		},
		[refreshUser],
	);

	const handleBan = React.useCallback((): void => {
		run(async (): Promise<void> => {
			await banMutation.mutateAsync({ userId: user.id, reason: trimmedReason });
			setReason("");
		});
	}, [banMutation, run, trimmedReason, user.id]);

	const handleUnban = React.useCallback((): void => {
		run(async (): Promise<void> => {
			await unbanMutation.mutateAsync({ userId: user.id });
		});
	}, [run, unbanMutation, user.id]);

	return (
		<div ref={ref}>
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Account ban</CardTitle>
					<CardDescription>A banned account cannot sign in, and every session it has is signed out at once.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{user.ban === null ? (
						<p className="text-sm text-muted-foreground">This account is not banned.</p>
					) : (
						<dl className="grid gap-4 sm:grid-cols-3">
							<div className="space-y-1">
								<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Banned at</dt>
								<dd className="text-sm text-foreground">{formatDateTimeWithSeconds(user.ban.bannedAt)}</dd>
							</div>
							<div className="space-y-1">
								<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Banned by</dt>
								<dd className="text-sm text-foreground">{user.ban.bannedBy?.fullName ?? "—"}</dd>
							</div>
							<div className="space-y-1 sm:col-span-3">
								<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reason</dt>
								<dd className="text-sm whitespace-pre-wrap text-foreground">{user.ban.reason}</dd>
							</div>
						</dl>
					)}

					{blocker !== null ? (
						<p className="text-sm text-muted-foreground">{BLOCKER_COPY[blocker]}</p>
					) : user.ban === null ? (
						<div className="space-y-2">
							<Label htmlFor="user-ban-reason">Reason</Label>
							<Textarea
								id="user-ban-reason"
								value={reason}
								onChange={handleReasonChange}
								maxLength={USER_BAN_REASON_MAX_LENGTH}
								placeholder="Why is this account banned? Only platform admins see this."
							/>
							<Button type="button" variant="destructive" onClick={handleBan} disabled={isPending || trimmedReason.length === 0}>
								Ban account
							</Button>
						</div>
					) : (
						<Button type="button" variant="outline" onClick={handleUnban} disabled={isPending}>
							Lift ban
						</Button>
					)}

					{error !== null ? (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
});
