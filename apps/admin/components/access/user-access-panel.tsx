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
import { AccessHierarchyGroup, AccessHierarchyRow, AccessHierarchySection } from "@/components/access/access-hierarchy";
import { UserDetailButton } from "@/components/users/user-detail-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectEmpty, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck, ShieldX } from "lucide-react";
import * as React from "react";

import { formatPermissionGrantVia } from "@/lib/format-permission-grant";
import { groupPermissionsByResource } from "@/lib/group-permissions-by-resource";

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
	const [grantPermissionId, setGrantPermissionId] = React.useState<string | null>(null);
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
		onSuccess: async () => {
			await invalidateUser();
			setGrantPermissionId(null);
		},
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
	const availablePermissions: readonly PermissionListItem[] = permissionsCatalog.filter((perm) => !directPermissionIds.has(perm.id));
	const directGrants = permissionsCatalog.filter((perm) => directPermissionIds.has(perm.id));
	const effectiveByResource = groupPermissionsByResource(user.permissions);

	const handleAssignRoleChange = React.useCallback((value: string | null): void => {
		setAssignRoleId(value);
	}, []);

	const handleGrantPermissionChange = React.useCallback((value: string | null): void => {
		setGrantPermissionId(value);
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

	const handleGrantPermissionClick = React.useCallback((): void => {
		if (grantPermissionId !== null) {
			grantPermission.mutate({ userId, permissionId: grantPermissionId });
		}
	}, [grantPermission, grantPermissionId, userId]);

	const handleCheckPermissionClick = React.useCallback((): void => {
		checkPermission.mutate({ userId, action: checkAction, resource: checkResource });
	}, [checkAction, checkPermission, checkResource, userId]);

	const handleRemoveRole = React.useCallback(
		(roleId: string): void => {
			removeRole.mutate({ userId, roleId });
		},
		[removeRole, userId],
	);

	const handleRevokePermission = React.useCallback(
		(permissionId: string): void => {
			revokePermission.mutate({ userId, permissionId });
		},
		[revokePermission, userId],
	);

	const roleRemoveHandlers = React.useMemo((): Readonly<Record<string, () => void>> => {
		const handlers: Record<string, () => void> = {};
		for (const role of user.roles) {
			handlers[role.id] = (): void => {
				handleRemoveRole(role.id);
			};
		}
		return handlers;
	}, [handleRemoveRole, user.roles]);

	const permissionRevokeHandlers = React.useMemo((): Readonly<Record<string, () => void>> => {
		const handlers: Record<string, () => void> = {};
		for (const perm of directGrants) {
			handlers[perm.id] = (): void => {
				handleRevokePermission(perm.id);
			};
		}
		return handlers;
	}, [directGrants, handleRevokePermission]);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Shield className="size-5" />
						Access hierarchy
					</CardTitle>
					<CardDescription>Roles, direct grants, and effective permissions in one tree. Inherited permissions follow assigned roles on the API.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{rolesCatalogError ? <p className="text-sm text-destructive">Could not load the role catalog. Check LIST:ROLE permission and refresh.</p> : null}
					{permissionsCatalogError ? <p className="text-sm text-destructive">Could not load the permission catalog. Check LIST:PERMISSION permission and refresh.</p> : null}

					<AccessHierarchySection title="Assigned roles" count={user.roles.length} description="Direct role assignments for this user.">
						{user.roles.length === 0 ? <p className="py-1 text-sm text-muted-foreground">No roles assigned.</p> : null}
						{user.roles.map((role) => (
							<AccessHierarchyRow
								key={role.id}
								label={role.name}
								description={role.description}
								onRemove={roleRemoveHandlers[role.id]}
								removeDisabled={removeRole.isPending}
							/>
						))}
						<div className="mt-3 flex flex-wrap items-end gap-3 border-t border-dashed pt-3">
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
					</AccessHierarchySection>

					<AccessHierarchySection
						title="Direct permission grants"
						count={directGrants.length}
						description="Permissions assigned directly to this user, not via roles."
						defaultOpen={directGrants.length > 0}>
						{directGrants.length === 0 ? <p className="py-1 text-sm text-muted-foreground">No direct grants.</p> : null}
						{directGrants.map((perm) => (
							<AccessHierarchyRow
								key={perm.id}
								label={`${perm.action}:${perm.resource}`}
								description={perm.description}
								mono
								onRemove={permissionRevokeHandlers[perm.id]}
								removeDisabled={revokePermission.isPending}
							/>
						))}
						<div className="mt-3 flex flex-wrap items-end gap-3 border-t border-dashed pt-3">
							<div className="min-w-[240px] flex-1 space-y-1">
								<Label htmlFor="grant-permission">Grant permission</Label>
								<Select value={grantPermissionId} onValueChange={handleGrantPermissionChange}>
									<SelectTrigger id="grant-permission" className="w-full">
										<SelectValue placeholder="Select permission…" />
									</SelectTrigger>
									<SelectContent>
										{availablePermissions.length === 0 ? <SelectEmpty text="No permissions available to grant" /> : null}
										{availablePermissions.map((perm) => (
											<SelectItem key={perm.id} value={perm.id}>
												{perm.action}:{perm.resource}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<UserDetailButton type="button" disabled={grantPermissionId === null || grantPermission.isPending} onClick={handleGrantPermissionClick}>
								Grant
							</UserDetailButton>
						</div>
					</AccessHierarchySection>

					<AccessHierarchySection title="Effective permissions" count={user.permissions.length} description="Union of role-based and direct grants, grouped by resource.">
						{effectiveByResource.length === 0 ? <p className="py-1 text-sm text-muted-foreground">No effective permissions.</p> : null}
						{effectiveByResource.map((group) => (
							<AccessHierarchyGroup key={group.resource} title={group.resource} count={group.permissions.length} depth={0}>
								{group.permissions.map((perm) => (
									<AccessHierarchyRow key={perm.id} label={perm.action} description={perm.description} mono depth={1} />
								))}
							</AccessHierarchyGroup>
						))}
					</AccessHierarchySection>
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
