"use client";

import { readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { AdminMfaRecoveryRequest } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import Link from "next/link";
import * as React from "react";

import { MfaRecoveryReviewPanel } from "@/components/security/mfa-recovery-review-panel";
import { MFA_RECOVERY_PENDING_QUEUE_HREF } from "@/lib/url-state/mfa-recovery";

/** The panel reviews the user's most recent request only (the API lists newest first). */
const LATEST_REQUEST_PAGE = { page: 1, limit: 1 };

export interface UserMfaRecoveryPanelProps {
	readonly userId: string;
	readonly userFullName: string;
	readonly userEmail: string;
	readonly twoFactorEnabled: boolean;
}

/** What the history shows — exactly one state at a time. */
export type UserMfaRecoveryState =
	| { readonly status: "loading" }
	| { readonly status: "error" }
	| { readonly status: "empty" }
	| { readonly status: "ready"; readonly latest: AdminMfaRecoveryRequest; readonly total: number };

/** Rows win over a background error; an error without rows is an error, never "no requests". */
export function resolveUserMfaRecoveryState(latest: AdminMfaRecoveryRequest | undefined, total: number, isError: boolean, isLoading: boolean): UserMfaRecoveryState {
	if (latest !== undefined) {
		return { status: "ready", latest, total };
	}
	if (isError) {
		return { status: "error" };
	}
	return isLoading ? { status: "loading" } : { status: "empty" };
}

/** The user's recovery requests (`GET /auth/admin/mfa/recovery/requests?filter[userId]=`) — only mounted when 2FA is on. */
function UserMfaRecoveryHistory({ userId }: { readonly userId: string }): React.JSX.Element {
	const { api } = useAuth();
	const requestsQuery = api.auth.adminMfaRecoveryRequests.useQuery({ ...LATEST_REQUEST_PAGE, filter: { userId: { eq: userId } } });
	const state = resolveUserMfaRecoveryState(requestsQuery.data?.data[0], readPaginatedTotal(requestsQuery.data?.meta), requestsQuery.isError, requestsQuery.isLoading);

	const { refetch } = requestsQuery;
	const handleReviewed = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	switch (state.status) {
		case "loading":
			return <p className="text-sm text-muted-foreground">Loading recovery history…</p>;
		case "error":
			return (
				<p role="alert" className="text-sm text-destructive">
					Could not load MFA recovery requests.
				</p>
			);
		case "empty":
			return (
				<p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
					No MFA recovery requests for this user. They can submit one from their security settings after verifying their password.
				</p>
			);
		case "ready":
			return (
				<>
					{/* Keyed by request: notes typed for one request never carry over to another. */}
					<MfaRecoveryReviewPanel key={state.latest.id} request={state.latest} onReviewed={handleReviewed} />
					{state.total > 1 ? (
						<p className="text-xs text-muted-foreground">
							Showing the most recent of {state.total} requests. Pending ones are also in the{" "}
							<Link href={MFA_RECOVERY_PENDING_QUEUE_HREF} className="text-primary underline-offset-4 hover:underline">
								MFA recovery queue
							</Link>
							.
						</p>
					) : null}
				</>
			);
	}
}

export const UserMfaRecoveryPanel = React.forwardRef<HTMLDivElement, UserMfaRecoveryPanelProps>(function UserMfaRecoveryPanel(
	{ userId, userFullName, userEmail, twoFactorEnabled },
	ref,
): React.JSX.Element {
	if (!twoFactorEnabled) {
		return (
			<div ref={ref}>
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">MFA recovery</CardTitle>
						<CardDescription>This user has not enrolled in two-factor authentication.</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<div ref={ref} className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">MFA recovery</CardTitle>
					<CardDescription>
						Review recovery requests when {userFullName} loses access to their authenticator and backup codes. Approved requests clear MFA after the security delay.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Account: <span className="font-medium text-foreground">{userEmail}</span>
					</p>
					<UserMfaRecoveryHistory userId={userId} />
				</CardContent>
			</Card>
		</div>
	);
});
