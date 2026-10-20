"use client";

import type { AdminUserDetail, Envelope, PermissionListItem } from "@workspace/shared";
import type { PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { UserAccessPanel } from "@/contexts/authorization";
import { ImpersonateUserButton } from "@/components/impersonation/impersonate-user-button";
import { UserDetailPageSkeleton } from "@/components/loading/user-skeletons";
import { UserMfaRecoveryPanel } from "@/contexts/identity/components/users/user-mfa-recovery-panel";
import { UserProfileOverview } from "@/contexts/identity/components/users/user-profile-overview";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { UserDetailBreadcrumb } from "@/contexts/identity/components/users/user-detail-breadcrumb";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import Link from "next/link";
import * as React from "react";
import { ROUTES } from "@/lib/routes";

export interface UserDetailViewProps {
	readonly userId: string;
	/** The server-prefetched `GET /auth/admin/users/:userId` envelope, or `undefined` when the prefetch failed. */
	readonly initialUser?: Envelope<AdminUserDetail> | undefined;
	/** The server-prefetched page of `GET /admin/permissions` the grant tree shows, or `undefined` when the prefetch failed. */
	readonly initialGrantsPage?: PrefetchedQuery<Envelope<PermissionListItem[]>> | undefined;
}

/**
 * `/users/[id]` — full user profile with hierarchical access management.
 */
export default function UserDetailView({ userId, initialUser, initialGrantsPage }: UserDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const userQuery = api.auth.adminUserDetail.useQuery({ userId }, initialDataOption(initialUser));

	const user = userQuery.data?.data;

	return (
		<>
			<UserDetailBreadcrumb displayName={user?.fullName} />

			{userQuery.isLoading && user === undefined ? (
				<UserDetailPageSkeleton />
			) : userQuery.isError || user === undefined ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
					Failed to load user.{" "}
					<Link href={ROUTES.users.list} className="underline">
						Back to users
					</Link>
				</div>
			) : (
				<div className="mx-auto w-full space-y-6">
					<header className="flex flex-wrap items-center justify-between gap-4">
						<div className="flex items-center gap-4">
							<div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
								{user.fullName.slice(0, 1)}
							</div>
							<div className="min-w-0">
								<h1 className="text-2xl font-semibold tracking-tight text-foreground">{user.fullName}</h1>
								<p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
							</div>
						</div>
						<ImpersonateUserButton targetUser={user} />
					</header>

					<UserProfileOverview user={user} />

					<UserMfaRecoveryPanel userId={userId} userFullName={user.fullName} userEmail={user.email} twoFactorEnabled={user.twoFactorEnabled} />

					<UserAccessPanel userId={userId} user={user} initialGrantsPage={initialGrantsPage} />
				</div>
			)}
		</>
	);
}
