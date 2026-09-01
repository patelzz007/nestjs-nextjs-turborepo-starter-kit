"use client";

import type { AdminUserDetail, PermissionListItem, RoleListItem } from "@workspace/shared";
import { UserAccessPanel } from "@/components/access/user-access-panel";
import { ImpersonateUserButton } from "@/components/impersonation/impersonate-user-button";
import { UserProfileOverview } from "@/components/users/user-profile-overview";
import { stubApiMeta } from "@/lib/api-envelope";
import { UserDetailBreadcrumb } from "@/components/users/user-detail-breadcrumb";
import { useAuth } from "@workspace/client/lib/auth";
import Link from "next/link";
import * as React from "react";

export interface UserDetailViewProps {
	readonly userId: string;
	readonly initialUser?: AdminUserDetail;
	readonly initialRoles?: readonly RoleListItem[];
	readonly initialPermissions?: readonly PermissionListItem[];
}

/**
 * `/users/[id]` — full user profile with hierarchical access management.
 */
export default function UserDetailView({ userId, initialUser, initialRoles, initialPermissions }: UserDetailViewProps): React.JSX.Element {
	const { api } = useAuth();

	const userQuery = api.auth.adminUserDetail.useQuery(
		{ userId },
		{ initialData: initialUser !== undefined ? { success: true, data: initialUser, meta: stubApiMeta() } : undefined },
	);
	const rolesQuery = api.admin.roles.list.useQuery(
		{},
		{
			initialData: initialRoles !== undefined ? { success: true, data: { items: [...initialRoles], total: initialRoles.length }, meta: stubApiMeta() } : undefined,
		},
	);
	const permissionsQuery = api.admin.permissions.list.useQuery(
		{},
		{
			initialData:
				initialPermissions !== undefined ? { success: true, data: { items: [...initialPermissions], total: initialPermissions.length }, meta: stubApiMeta() } : undefined,
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
					<Link href="/users/all" className="underline">
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
