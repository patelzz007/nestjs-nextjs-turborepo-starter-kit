"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { buildPermissionTree } from "@/lib/permissions/build-permission-tree";
import { AccessPermissionExplorerTree } from "@/components/access/access-permission-explorer-tree";
import { PermissionCheckForm, PermissionCheckResult } from "@/components/access/permission-check-form";
import { toastMutationError } from "@/lib/api/mutation-error";
import { PERMISSION, type CheckPermissionInput, type CheckPermissionResponse, type Envelope, type PermissionListResponse, type RoleListResponse } from "@workspace/shared";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import * as React from "react";

export interface AccessControlPanelProps {
	/** The server-prefetched `GET /admin/roles` envelope, or `undefined` when the prefetch failed. */
	readonly initialRoles?: Envelope<RoleListResponse> | undefined;
	/** The server-prefetched `GET /admin/permissions` envelope, or `undefined` when the prefetch failed. */
	readonly initialPermissions?: Envelope<PermissionListResponse> | undefined;
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

	const roles = rolesQuery.data?.data.items ?? [];
	const permissions = React.useMemo(() => permissionsQuery.data?.data.items ?? [], [permissionsQuery.data?.data.items]);
	const permissionTree = React.useMemo(() => buildPermissionTree(permissions), [permissions]);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Access control</h1>
				<p className="text-sm text-muted-foreground">Browse roles and permissions. Assign per-user access from a user profile.</p>
			</header>

			<Tabs defaultValue={defaultTab}>
				<TabsList>
					{canListRoles ? <TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger> : null}
					{canListPermissions ? <TabsTrigger value="permissions">Permissions ({permissions.length})</TabsTrigger> : null}
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
								{roles.map((role) => (
									<div key={role.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
										<div>
											<p className="font-medium">{role.name}</p>
											{role.description !== null ? <p className="text-xs text-muted-foreground">{role.description}</p> : null}
										</div>
										<Badge variant={role.isActive ? "outline" : "destructive-light"}>{role.isActive ? "Active" : "Inactive"}</Badge>
									</div>
								))}
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
								<AccessPermissionExplorerTree groups={permissionTree} emptyMessage="No permissions in catalog." defaultOpen={false} />
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
