"use client";

import { initialDataOption, stubApiMeta, successEnvelope } from "@workspace/client/lib/api/envelope";
import { formatPermissionGrantVia } from "@/lib/permissions/format-permission-grant";
import { buildPermissionTree } from "@/lib/permissions/build-permission-tree";
import { AccessPermissionExplorerTree } from "@/components/access/access-permission-explorer-tree";
import {
	PERMISSION,
	PermissionActionSchema,
	PermissionResourceSchema,
	type CheckPermissionResponse,
	type PermissionAction,
	type PermissionListItem,
	type PermissionResource,
	type RoleListItem,
} from "@workspace/shared";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/navigation/tabs";
import { ShieldCheck, ShieldX } from "lucide-react";
import * as React from "react";

const PERMISSION_ACTIONS: readonly PermissionAction[] = ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"];

const PERMISSION_RESOURCES: readonly PermissionResource[] = PermissionResourceSchema.options;

export interface AccessControlPanelProps {
	readonly initialRoles?: readonly RoleListItem[] | undefined;
	readonly initialPermissions?: readonly PermissionListItem[] | undefined;
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
			...initialDataOption(initialRoles !== undefined ? successEnvelope({ items: [...initialRoles], total: initialRoles.length }, stubApiMeta()) : undefined),
		},
	);
	const permissionsQuery = api.admin.permissions.list.useQuery(
		{},
		{
			enabled: canListPermissions,
			...initialDataOption(
				initialPermissions !== undefined ? successEnvelope({ items: [...initialPermissions], total: initialPermissions.length }, stubApiMeta()) : undefined,
			),
		},
	);

	const [checkUserId, setCheckUserId] = React.useState<string>("");
	const [checkAction, setCheckAction] = React.useState<PermissionAction>("READ");
	const [checkResource, setCheckResource] = React.useState<PermissionResource>("USER");
	const [checkResult, setCheckResult] = React.useState<CheckPermissionResponse | null>(null);

	const checkPermission = api.admin.permissions.check.useMutation({
		onSuccess: (resp) => {
			setCheckResult(resp.data);
		},
	});

	const handleCheckUserIdChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setCheckUserId(event.target.value);
	}, []);

	const handleCheckActionSelect = React.useCallback((value: string | null): void => {
		const parsed = PermissionActionSchema.safeParse(value);
		if (parsed.success) {
			setCheckAction(parsed.data);
		}
	}, []);

	const handleCheckResourceSelect = React.useCallback((value: string | null): void => {
		const parsed = PermissionResourceSchema.safeParse(value);
		if (parsed.success) {
			setCheckResource(parsed.data);
		}
	}, []);

	const handleCheckPermissionClick = React.useCallback((): void => {
		checkPermission.mutate({ userId: checkUserId, action: checkAction, resource: checkResource });
	}, [checkAction, checkPermission, checkResource, checkUserId]);

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
										<Badge variant={role.isActive ? "outline" : "destructive"}>{role.isActive ? "Active" : "Inactive"}</Badge>
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
								<div className="space-y-1">
									<Label htmlFor="checker-user-id">User ID</Label>
									<input
										id="checker-user-id"
										className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
										placeholder="UUID"
										value={checkUserId}
										onChange={handleCheckUserIdChange}
									/>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-1">
										<Label htmlFor="checker-action">Action</Label>
										<Select value={checkAction} onValueChange={handleCheckActionSelect}>
											<SelectTrigger id="checker-action" className="w-full">
												<SelectValue placeholder="Action" />
											</SelectTrigger>
											<SelectContent>
												{PERMISSION_ACTIONS.map((action) => (
													<SelectItem key={action} value={action}>
														{action}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1">
										<Label htmlFor="checker-resource">Resource</Label>
										<Select value={checkResource} onValueChange={handleCheckResourceSelect}>
											<SelectTrigger id="checker-resource" className="w-full">
												<SelectValue placeholder="Resource" />
											</SelectTrigger>
											<SelectContent>
												{PERMISSION_RESOURCES.map((resource) => (
													<SelectItem key={resource} value={resource}>
														{resource}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
								<Button type="button" disabled={checkUserId.length === 0 || checkPermission.isPending} onClick={handleCheckPermissionClick}>
									Check permission
								</Button>

								{checkResult !== null ? (
									<div className="rounded-lg border bg-muted/30 p-4">
										<div className="flex items-center gap-2 text-sm font-medium">
											{checkResult.allowed ? <ShieldCheck className="size-4 text-green-600" /> : <ShieldX className="size-4 text-destructive" />}
											{checkResult.allowed ? "Allowed" : "Denied"}
										</div>
										<ul className="mt-2 space-y-1 text-sm text-muted-foreground">
											{checkResult.grants.map((grant, index) => (
												<li key={`${grant.via}-${grant.detail ?? ""}-${String(index)}`}>
													<span className="font-medium text-foreground">{formatPermissionGrantVia(grant.via)}</span>
													{grant.detail !== undefined ? ` — ${grant.detail}` : ""}
												</li>
											))}
										</ul>
									</div>
								) : null}
							</CardContent>
						</Card>
					</TabsContent>
				) : null}
			</Tabs>
		</div>
	);
}
