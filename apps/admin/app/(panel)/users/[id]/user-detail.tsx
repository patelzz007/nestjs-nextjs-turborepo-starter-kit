"use client";

import { PERMISSION, type AdminUserDetail, type Envelope, type PermissionListResponse, type RoleListResponse } from "@workspace/shared";
import { UserAccessPanel } from "@/components/access/user-access-panel";
import { ImpersonateUserButton } from "@/components/impersonation/impersonate-user-button";
import { UserMfaRecoveryPanel } from "@/components/users/user-mfa-recovery-panel";
import { UserProfileOverview } from "@/components/users/user-profile-overview";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { UserDetailBreadcrumb } from "@/components/users/user-detail-breadcrumb";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import Link from "next/link";
import * as React from "react";
import { ROUTES } from "@/lib/routes";

export interface UserDetailViewProps {
	readonly userId: string;
	/** The server-prefetched `GET /auth/admin/users/:userId` envelope, or `undefined` when the prefetch failed. */
	readonly initialUser?: Envelope<AdminUserDetail> | undefined;
	/** The server-prefetched `GET /admin/roles` envelope, or `undefined` when the prefetch failed. */
	readonly initialRoles?: Envelope<RoleListResponse> | undefined;
	/** The server-prefetched `GET /admin/permissions` envelope, or `undefined` when the prefetch failed. */
	readonly initialPermissions?: Envelope<PermissionListResponse> | undefined;
}

/**
 * `/users/[id]` — full user profile with hierarchical access management.
 */
export default function UserDetailView({ userId, initialUser, initialRoles, initialPermissions }: UserDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	// Catalog reads are separately permissioned (LIST ROLE / LIST PERMISSION) — skip calls that would 403.
	const canListRoles = can(PERMISSION.ROLE.LIST);
	const canListPermissions = can(PERMISSION.PERMISSION.LIST);

	const userQuery = api.auth.adminUserDetail.useQuery({ userId }, initialDataOption(initialUser));
	const rolesQuery = api.admin.roles.list.useQuery(
		{},
		{
			enabled: canListRoles,
			...initialDataOption(initialRoles),
		},
	);
	const permissionsQuery = api.admin.permissions.list.useQuery(
		{},
		{
			enabled: canListPermissions,
			...initialDataOption(initialPermissions),
		},
	);

	const user = userQuery.data?.data;
	const rolesCatalog = rolesQuery.data?.data.items ?? [];
	const permissionsCatalog = permissionsQuery.data?.data.items ?? [];

	return (
		<>
			<UserDetailBreadcrumb displayName={user?.fullName} />

			{userQuery.isLoading && user === undefined ? (
				<p className="text-sm text-muted-foreground">Loading user…</p>
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

					<UserAccessPanel
						userId={userId}
						user={user}
						rolesCatalog={rolesCatalog}
						permissionsCatalog={permissionsCatalog}
						rolesCatalogError={rolesQuery.isError}
						permissionsCatalogError={permissionsQuery.isError}
					/>
				</div>
			)}
		</>
	);
}
