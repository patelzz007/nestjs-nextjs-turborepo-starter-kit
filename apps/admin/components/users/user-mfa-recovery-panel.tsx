"use client";

import type { AdminMfaRecoveryRequest } from "@workspace/shared";
import { readPaginatedTotal, stubPaginatedMeta } from "@/lib/api-envelope";
import { MfaRecoveryReviewPanel } from "@/components/security/mfa-recovery-review-panel";
import { useAuth } from "@workspace/client/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import Link from "next/link";
import * as React from "react";

export interface UserMfaRecoveryPanelProps {
	readonly userId: string;
	readonly userFullName: string;
	readonly userEmail: string;
	readonly twoFactorEnabled: boolean;
}

export const UserMfaRecoveryPanel = React.forwardRef<HTMLDivElement, UserMfaRecoveryPanelProps>(function UserMfaRecoveryPanel(
	{ userId, userFullName, userEmail, twoFactorEnabled },
	ref,
): React.JSX.Element {
	const { api } = useAuth();

	const requestsQuery = api.auth.adminMfaRecoveryRequests.useQuery({
		userId,
		page: 1,
		limit: 5,
	});

	const requests: readonly AdminMfaRecoveryRequest[] = requestsQuery.data?.data ?? [];
	const latestRequest: AdminMfaRecoveryRequest | undefined = requests[0];

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

					{requestsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading recovery history…</p> : null}
					{requestsQuery.isError ? <p className="text-sm text-destructive">Could not load MFA recovery requests.</p> : null}

					{latestRequest !== undefined ? (
						<MfaRecoveryReviewPanel request={latestRequest} onReviewed={(): void => void requestsQuery.refetch()} />
					) : (
						<p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
							No MFA recovery requests for this user. They can submit one from their security settings after verifying their password.
						</p>
					)}

					{requests.length > 1 ? (
						<p className="text-xs text-muted-foreground">
							Showing the most recent request. View older requests in the{" "}
							<Link href="/settings/security/mfa-recovery" className="text-primary underline-offset-4 hover:underline">
								global MFA recovery queue
							</Link>
							.
						</p>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
});
