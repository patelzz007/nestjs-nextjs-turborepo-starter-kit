"use client";

import {
	PermissionActionSchema,
	PermissionResourceSchema,
	type AdminUserDetail,
	type PermissionAction,
	type PermissionListItem,
	type PermissionResource,
	type RoleListItem,
} from "@workspace/shared";
import { invalidateSessionAuth } from "@workspace/client/lib/auth/invalidate-session-auth";
import { useAuth } from "@workspace/client/lib/auth";
import { AccessHierarchyRow } from "@/components/access/access-hierarchy";
import { AccessPermissionTree } from "@/components/access/access-permission-tree";
import { UserDetailButton } from "@/components/users/user-detail-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectEmpty, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/navigation/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck, ShieldX } from "lucide-react";
import * as React from "react";

import { buildPermissionTree } from "@/lib/build-permission-tree";
import { formatPermissionGrantVia } from "@/lib/format-permission-grant";

const PERMISSION_ACTIONS: readonly PermissionAction[] = ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"];

const PERMISSION_RESOURCES: readonly PermissionResource[] = PermissionResourceSchema.options;

export interface UserAccessPanelProps {
	readonly userId: string;
	readonly user: AdminUserDetail;
	readonly rolesCatalog: readonly RoleListItem[];
	readonly permissionsCatalog: readonly PermissionListItem[];
	readonly rolesCatalogError?: boolean;
	readonly permissionsCatalogError?: boolean;
}

/**
 * Smart panel for managing a user's roles and direct permissions via admin RBAC APIs.
 */
export function UserAccessPanel({
	userId,
	user,
	rolesCatalog,
	permissionsCatalog,
	rolesCatalogError = false,
	permissionsCatalogError = false,
}: UserAccessPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const [assignRoleId, setAssignRoleId] = React.useState<string | null>(null);
	const [checkAction, setCheckAction] = React.useState<PermissionAction>("READ");
	const [checkResource, setCheckResource] = React.useState<PermissionResource>("USER");
	const [checkResult, setCheckResult] = React.useState<{ readonly allowed: boolean; readonly grants: readonly { readonly via: string; readonly detail?: string }[] } | null>(
		null,
	);

	const invalidateUser = React.useCallback(async (): Promise<void> => {
		await invalidateSessionAuth(queryClient);
		await queryClient.invalidateQueries({ queryKey: ["auth", "admin-user", userId] });
	}, [queryClient, userId]);

	const assignRole = api.admin.roles.userAssign.useMutation({
		onSuccess: async () => {
			await invalidateUser();
			setAssignRoleId(null);
		},
	});

	const removeRole = api.admin.roles.userRemove.useMutation({
		onSuccess: invalidateUser,
	});

	const grantPermission = api.admin.permissions.userGrant.useMutation({
		onSuccess: invalidateUser,
	});

	const revokePermission = api.admin.permissions.userRevoke.useMutation({
		onSuccess: invalidateUser,
	});

	const checkPermission = api.admin.permissions.check.useMutation({
		onSuccess: (resp) => {
			setCheckResult(resp.data);
		},
	});

	const assignedRoleIds: Set<string> = new Set<string>(user.roles.map((role) => role.id));
	const directPermissionIds: Set<string> = new Set<string>(user.directPermissionIds);

	const availableRoles: readonly RoleListItem[] = rolesCatalog.filter((role) => !assignedRoleIds.has(role.id) && role.isActive);
	const directGrants = permissionsCatalog.filter((perm) => directPermissionIds.has(perm.id));
	const catalogPermissionTree = buildPermissionTree(permissionsCatalog);
	const effectivePermissionTree = buildPermissionTree(user.permissions);

	const inheritedPermissionIds: Set<string> = React.useMemo((): Set<string> => {
		const directIds = new Set<string>(user.directPermissionIds);
		const inherited = new Set<string>();
		for (const permission of user.permissions) {
			if (!directIds.has(permission.id)) {
				inherited.add(permission.id);
			}
		}
		return inherited;
	}, [user.directPermissionIds, user.permissions]);

	const permissionTogglePending: boolean = grantPermission.isPending || revokePermission.isPending;

	const handleAssignRoleChange = React.useCallback((value: string | null): void => {
		setAssignRoleId(value);
	}, []);

	const handleCheckActionChange = React.useCallback((value: string | null): void => {
		const parsed = PermissionActionSchema.safeParse(value);
		if (parsed.success) {
			setCheckAction(parsed.data);
		}
	}, []);

	const handleCheckResourceChange = React.useCallback((value: string | null): void => {
		const parsed = PermissionResourceSchema.safeParse(value);
		if (parsed.success) {
			setCheckResource(parsed.data);
		}
	}, []);

	const handleAssignRoleClick = React.useCallback((): void => {
		if (assignRoleId !== null) {
			assignRole.mutate({ userId, roleId: assignRoleId });
		}
	}, [assignRole, assignRoleId, userId]);

	const handleToggleDirectPermission = React.useCallback(
		(permissionId: string, selected: boolean): void => {
			if (selected) {
				grantPermission.mutate({ userId, permissionId });
				return;
			}
			revokePermission.mutate({ userId, permissionId });
		},
		[grantPermission, revokePermission, userId],
	);

	const handleCheckPermissionClick = React.useCallback((): void => {
		checkPermission.mutate({ userId, action: checkAction, resource: checkResource });
	}, [checkAction, checkPermission, checkResource, userId]);

	const handleRemoveRole = React.useCallback(
		(roleId: string): void => {
			removeRole.mutate({ userId, roleId });
		},
		[removeRole, userId],
	);

	const selectedDirectPermissionIds: Set<string> = directPermissionIds;

	const roleRemoveHandlers = React.useMemo((): Readonly<Record<string, () => void>> => {
		const handlers: Record<string, () => void> = {};
		for (const role of user.roles) {
			handlers[role.id] = (): void => {
				handleRemoveRole(role.id);
			};
		}
		return handlers;
	}, [handleRemoveRole, user.roles]);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Shield className="size-5" />
						Access hierarchy
					</CardTitle>
					<CardDescription>Manage roles, direct grants, and review effective permissions for this user.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{rolesCatalogError ? <p className="text-sm text-destructive">Could not load the role catalog. Check LIST:ROLE permission and refresh.</p> : null}
					{permissionsCatalogError ? <p className="text-sm text-destructive">Could not load the permission catalog. Check LIST:PERMISSION permission and refresh.</p> : null}

					<Tabs defaultValue="roles">
						<TabsList className="h-10 w-full">
							<TabsTrigger value="roles">Assigned Roles ({String(user.roles.length)})</TabsTrigger>
							<TabsTrigger value="direct-grants">Direct Permission Grants ({String(directGrants.length)})</TabsTrigger>
							<TabsTrigger value="effective">Effective Permissions ({String(user.permissions.length)})</TabsTrigger>
						</TabsList>

						<TabsContent value="roles" className="mt-4 space-y-4">
							<p className="text-sm text-muted-foreground">Direct role assignments for this user.</p>
							{user.roles.length === 0 ? <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No roles assigned.</p> : null}
							<div className="space-y-2">
								{user.roles.map((role) => (
									<AccessHierarchyRow
										key={role.id}
										label={role.name}
										description={role.description}
										onRemove={roleRemoveHandlers[role.id]}
										removeDisabled={removeRole.isPending}
									/>
								))}
							</div>
							<div className="flex flex-wrap items-end gap-3 border-t border-dashed pt-4">
								<div className="min-w-[200px] flex-1 space-y-1">
									<Label htmlFor="assign-role">Add role</Label>
									<Select value={assignRoleId} onValueChange={handleAssignRoleChange}>
										<SelectTrigger id="assign-role" className="w-full">
											<SelectValue placeholder="Select role…" />
										</SelectTrigger>
										<SelectContent>
											{availableRoles.length === 0 ? <SelectEmpty text="No roles available to assign" /> : null}
											{availableRoles.map((role) => (
												<SelectItem key={role.id} value={role.id}>
													{role.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<UserDetailButton type="button" disabled={assignRoleId === null || assignRole.isPending} onClick={handleAssignRoleClick}>
									Assign role
								</UserDetailButton>
							</div>
						</TabsContent>

						<TabsContent value="direct-grants" className="mt-4 space-y-4">
							<p className="text-sm text-muted-foreground">
								Check permissions to grant directly to this user. Uncheck to revoke. “Via role” means the user already has it from an assigned role.
							</p>
							<AccessPermissionTree
								groups={catalogPermissionTree}
								emptyMessage="No permissions in catalog."
								defaultOpen={false}
								selectable
								selectedPermissionIds={selectedDirectPermissionIds}
								inheritedPermissionIds={inheritedPermissionIds}
								onTogglePermission={handleToggleDirectPermission}
								toggleDisabled={permissionTogglePending}
							/>
						</TabsContent>

						<TabsContent value="effective" className="mt-4 space-y-4">
							<p className="text-sm text-muted-foreground">Union of role-based and direct grants. Expand a category to browse actions.</p>
							<AccessPermissionTree groups={effectivePermissionTree} emptyMessage="No effective permissions." defaultOpen={false} />
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Permission checker</CardTitle>
					<CardDescription>
						Inspect why this user has or lacks a permission. Seed roles are flat — customer User accounts only get customer-app permissions unless you assign staff roles or
						direct grants.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<Label htmlFor="check-action">Action</Label>
							<Select value={checkAction} onValueChange={handleCheckActionChange}>
								<SelectTrigger id="check-action" className="w-full">
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
							<Label htmlFor="check-resource">Resource</Label>
							<Select value={checkResource} onValueChange={handleCheckResourceChange}>
								<SelectTrigger id="check-resource" className="w-full">
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
					<UserDetailButton type="button" disabled={checkPermission.isPending} onClick={handleCheckPermissionClick}>
						Run check
					</UserDetailButton>

					{checkResult !== null ? (
						<div className="rounded-lg border bg-muted/30 p-4">
							<div className="flex items-center gap-2 text-sm font-medium">
								{checkResult.allowed ? <ShieldCheck className="size-4 text-green-600" /> : <ShieldX className="size-4 text-destructive" />}
								{checkResult.allowed ? "Allowed" : "Denied"}
							</div>
							{checkResult.grants.length > 0 ? (
								<ul className="mt-2 space-y-1 border-l border-border pl-3 text-sm text-muted-foreground">
									{checkResult.grants.map((grant, index) => (
										<li key={`${grant.via}-${grant.detail ?? ""}-${String(index)}`}>
											<span className="font-medium text-foreground">{formatPermissionGrantVia(grant.via)}</span>
											{grant.detail !== undefined ? ` — ${grant.detail}` : ""}
										</li>
									))}
								</ul>
							) : (
								<p className="mt-2 text-sm text-muted-foreground">No matching grants.</p>
							)}
						</div>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
