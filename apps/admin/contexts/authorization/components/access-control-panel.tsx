"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { initialDataOption, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlListPager } from "@workspace/client/lib/url-state/use-url-list-pager";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { PERMISSIONS_URL_STATE, ROLES_URL_STATE, toPermissionsQuery, toRolesQuery } from "@/contexts/authorization/url-state/access";
import { buildPermissionTree } from "@/contexts/authorization/lib/build-permission-tree";
import { PermissionGroupsSkeleton, RoleRowsSkeleton } from "@/components/loading/access-control-skeletons";
import { PERMISSIONS_LOADING_LABELS, ROLES_LOADING_LABELS } from "@/components/loading/loading-labels";
import { PermissionCheckForm, PermissionCheckResult } from "@/contexts/authorization/components/permission-check-form";
import { toastMutationError } from "@/lib/api/mutation-error";
import { PERMISSION, type CheckPermissionInput, type CheckPermissionResponse, type Envelope, type PermissionListItem, type RoleListItem } from "@workspace/shared";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ListPager } from "@workspace/ui/components/list-pager";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import dynamic from "next/dynamic";
import * as React from "react";

function renderPermissionGroupsSkeleton(): React.JSX.Element {
	return <PermissionGroupsSkeleton />;
}

/** The explorer tree (`@headless-tree`) in its own chunk; it still renders on the server (plan §19.4). */
const AccessPermissionExplorerTree = dynamic(() => import("./access-permission-explorer-tree").then((module) => module.AccessPermissionExplorerTree), {
	loading: renderPermissionGroupsSkeleton,
});

export interface AccessControlPanelProps {
	/** The server-prefetched page of `GET /admin/roles`, or `undefined` when the prefetch failed. */
	readonly initialRoles?: PrefetchedQuery<Envelope<RoleListItem[]>> | undefined;
	/** The server-prefetched page of `GET /admin/permissions`, or `undefined` when the prefetch failed. */
	readonly initialPermissions?: PrefetchedQuery<Envelope<PermissionListItem[]>> | undefined;
}

type AccessControlTab = "roles" | "permissions" | "checker";

/**
 * The first tab, in display order, that the session may open. The page's
 * route rule (`ROUTES.settings.access`: ROLE.LIST, PERMISSION.LIST or
 * PERMISSION.READ, mode "any") is enforced by the route guard
 * (lib/navigation/route-authorization.ts), so at least one tab is always
 * permitted here — when neither list tab is, the checker is.
 */
function firstPermittedTab(canListRoles: boolean, canListPermissions: boolean): AccessControlTab {
	if (canListRoles) {
		return "roles";
	}
	if (canListPermissions) {
		return "permissions";
	}
	return "checker";
}

/**
 * Each tab mirrors one API route: roles → `GET /admin/roles` (LIST ROLE),
 * permissions → `GET /admin/permissions` (LIST PERMISSION), checker →
 * `POST /admin/permissions/check` (READ PERMISSION). Tabs the session cannot
 * use are hidden and their queries skipped. The page-level requirement (any
 * one of the three) is the route guard's job, so it is not repeated here.
 */
export default function AccessControlPanel({ initialRoles, initialPermissions }: AccessControlPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const canListRoles = can(PERMISSION.ROLE.LIST);
	const canListPermissions = can(PERMISSION.PERMISSION.LIST);
	const canCheckPermissions = can(PERMISSION.PERMISSION.READ);
	const defaultTab = firstPermittedTab(canListRoles, canListPermissions);

	// Each list's page is URL state under its own keys (`?rolesPage=`, `?permissionsPage=`).
	const [rolesState, updateRolesState] = useUrlState(ROLES_URL_STATE);
	const [permissionsState, updatePermissionsState] = useUrlState(PERMISSIONS_URL_STATE);
	const rolesQuery = api.admin.roles.list.useQuery(toRolesQuery(rolesState), {
		enabled: canListRoles,
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialRoles, ROLES_URL_STATE.serialize(rolesState))),
	});
	const permissionsQuery = api.admin.permissions.list.useQuery(toPermissionsQuery(permissionsState), {
		enabled: canListPermissions,
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPermissions, PERMISSIONS_URL_STATE.serialize(permissionsState))),
	});
	const rolesPager = useUrlListPager(rolesState, updateRolesState, rolesQuery.data?.meta);
	const permissionsPager = useUrlListPager(permissionsState, updatePermissionsState, permissionsQuery.data?.meta);

	const [checkResult, setCheckResult] = React.useState<CheckPermissionResponse | null>(null);

	const checkPermission = api.admin.permissions.check.useMutation({
		onSuccess: (resp) => {
			setCheckResult(resp.data);
		},
		onError: (error) => {
			setCheckResult(null);
			toastMutationError("Could not check the permission", error);
		},
	});

	const handleCheck = React.useCallback(
		(input: CheckPermissionInput): void => {
			checkPermission.mutate(input);
		},
		[checkPermission],
	);

	const roles = rolesQuery.data?.data ?? [];
	// The tab counts are the server's totals, not the rows of the current page.
	const roleTotal: number = readPaginatedTotal(rolesQuery.data?.meta);
	const permissionTotal: number = readPaginatedTotal(permissionsQuery.data?.meta);
	const permissions = React.useMemo(() => permissionsQuery.data?.data ?? [], [permissionsQuery.data?.data]);
	const permissionTree = React.useMemo(() => buildPermissionTree(permissions), [permissions]);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Access control</h1>
				<p className="text-sm text-muted-foreground">Browse roles and permissions. Assign per-user access from a user profile.</p>
			</header>

			<Tabs defaultValue={defaultTab}>
				<TabsList>
					{canListRoles ? <TabsTrigger value="roles">Roles ({roleTotal})</TabsTrigger> : null}
					{canListPermissions ? <TabsTrigger value="permissions">Permissions ({permissionTotal})</TabsTrigger> : null}
					{canCheckPermissions ? <TabsTrigger value="checker">Permission checker</TabsTrigger> : null}
				</TabsList>

				{canListRoles ? (
					<TabsContent value="roles" className="mt-4">
						<Card>
							<CardHeader>
								<CardTitle>Roles</CardTitle>
								<CardDescription>Role catalog from the API. Assign roles to users on their profile page.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2">
								{rolesQuery.isLoading ? (
									<SkeletonRegion labels={ROLES_LOADING_LABELS} className="flex flex-col gap-2">
										<RoleRowsSkeleton />
									</SkeletonRegion>
								) : null}
								{roles.map((role) => (
									<div key={role.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
										<div>
											<p className="font-medium">{role.name}</p>
											{role.description !== null ? <p className="text-xs text-muted-foreground">{role.description}</p> : null}
										</div>
										<Badge variant={role.isActive ? "outline" : "destructive-light"}>{role.isActive ? "Active" : "Inactive"}</Badge>
									</div>
								))}
								{rolesPager.isPaged ? (
									<ListPager
										page={rolesPager.page}
										totalPages={rolesPager.totalPages}
										hasPrevious={rolesPager.hasPrevious}
										hasNext={rolesPager.hasNext}
										onPrevious={rolesPager.onPrevious}
										onNext={rolesPager.onNext}
										disabled={rolesQuery.isPlaceholderData}
									/>
								) : null}
							</CardContent>
						</Card>
					</TabsContent>
				) : null}

				{canListPermissions ? (
					<TabsContent value="permissions" className="mt-4">
						<Card className="overflow-hidden">
							<CardHeader className="border-b bg-muted/20">
								<CardTitle>Permissions</CardTitle>
								<CardDescription>Action + resource pairs grouped by category. Grant or revoke direct user permissions on user profiles.</CardDescription>
							</CardHeader>
							<CardContent className="p-4 sm:p-6">
								{permissionsQuery.isError ? (
									<p className="text-sm text-destructive">Could not load the permission catalog. Check LIST:PERMISSION permission and refresh.</p>
								) : null}
								{permissionsQuery.isLoading ? (
									<SkeletonRegion labels={PERMISSIONS_LOADING_LABELS}>
										<PermissionGroupsSkeleton />
									</SkeletonRegion>
								) : (
									<AccessPermissionExplorerTree groups={permissionTree} emptyMessage="No permissions in catalog." defaultOpen={false} />
								)}
								{permissionsPager.isPaged ? (
									<ListPager
										className="mt-4"
										page={permissionsPager.page}
										totalPages={permissionsPager.totalPages}
										hasPrevious={permissionsPager.hasPrevious}
										hasNext={permissionsPager.hasNext}
										onPrevious={permissionsPager.onPrevious}
										onNext={permissionsPager.onNext}
										disabled={permissionsQuery.isPlaceholderData}
									/>
								) : null}
							</CardContent>
						</Card>
					</TabsContent>
				) : null}

				{canCheckPermissions ? (
					<TabsContent value="checker" className="mt-4">
						<Card>
							<CardHeader>
								<CardTitle>Permission checker</CardTitle>
								<CardDescription>
									POST /admin/permissions/check — inspect grant provenance. Seed roles are flat (no hierarchy); staff and customer roles are separate permission sets.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<PermissionCheckForm idPrefix="checker" isPending={checkPermission.isPending} onCheck={handleCheck} submitLabel="Check permission" />
								{checkResult !== null ? <PermissionCheckResult result={checkResult} /> : null}
							</CardContent>
						</Card>
					</TabsContent>
				) : null}
			</Tabs>
		</div>
	);
}
