"use client";

import { PERMISSION, type AdminUserDetail, type CheckPermissionInput, type CheckPermissionResponse, type Envelope, type PermissionListItem } from "@workspace/shared";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlListPager } from "@workspace/client/lib/url-state/use-url-list-pager";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth, invalidateSessionAuth } from "@workspace/client/lib/contexts/identity";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { AccessRestrictedNotice } from "@/components/common/access-restricted-notice";
import { AccessHierarchyRow } from "@/contexts/authorization/components/access-hierarchy";
import { AccessPermissionTree } from "@/contexts/authorization/components/access-permission-tree";
import { UserDetailButton } from "@/contexts/identity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { ListPager } from "@workspace/ui/components/list-pager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import * as React from "react";

import { buildPermissionTree } from "@/contexts/authorization/lib/build-permission-tree";
import { toastMutationError } from "@/lib/api/mutation-error";
import { PermissionCheckForm, PermissionCheckResult } from "@/contexts/authorization/components/permission-check-form";
import { RolePicker } from "@/contexts/authorization/components/role-picker";
import { GRANTS_URL_STATE, toPermissionsQuery } from "@/contexts/authorization/url-state/access";

export interface UserAccessPanelProps {
	readonly userId: string;
	readonly user: AdminUserDetail;
	/** The server-prefetched page of `GET /admin/permissions` the grant tree shows, or `undefined` when not prefetched. */
	readonly initialGrantsPage?: PrefetchedQuery<Envelope<PermissionListItem[]>> | undefined;
}

/**
 * Smart panel for managing a user's roles and direct permissions via admin RBAC APIs.
 *
 * Gating mirrors the API: role assign/remove need `role.update`
 * (`POST /admin/roles/user/{assign,remove}`), direct grant/revoke need
 * `permission.update` (`POST /admin/permissions/user/{grant,revoke}`), and
 * the checker needs `permission.read` (`POST /admin/permissions/check`).
 */
export function UserAccessPanel({ userId, user, initialGrantsPage }: UserAccessPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const queryClient = useQueryClient();
	const canManageRoles = can(PERMISSION.ROLE.UPDATE);
	const canManageDirectGrants = can(PERMISSION.PERMISSION.UPDATE);
	const canCheckPermissions = can(PERMISSION.PERMISSION.READ);
	// Catalog reads are separately permissioned (LIST ROLE / LIST PERMISSION) — skip calls that would 403.
	const canListRoles = can(PERMISSION.ROLE.LIST);
	const canListPermissions = can(PERMISSION.PERMISSION.LIST);

	// The grant tree pages through the permission catalog; its page is URL state (`?grantsPage=`).
	const [grantsState, updateGrantsState] = useUrlState(GRANTS_URL_STATE);
	const grantsQuery = api.admin.permissions.list.useQuery(toPermissionsQuery(grantsState), {
		enabled: canManageDirectGrants && canListPermissions,
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialGrantsPage, GRANTS_URL_STATE.serialize(grantsState))),
	});
	const grantsPager = useUrlListPager(grantsState, updateGrantsState, grantsQuery.data?.meta);

	const [assignRoleId, setAssignRoleId] = React.useState<string>("");
	const [checkResult, setCheckResult] = React.useState<CheckPermissionResponse | null>(null);

	const invalidateUser = React.useCallback(async (): Promise<void> => {
		await invalidateSessionAuth(queryClient);
		await queryClient.invalidateQueries({ queryKey: apiRouter.auth.adminUserDetail.scopeKey({ userId }) });
	}, [queryClient, userId]);

	const assignRole = api.admin.roles.userAssign.useMutation({
		onSuccess: async () => {
			await invalidateUser();
			setAssignRoleId("");
		},
		onError: (error) => {
			toastMutationError("Could not assign the role", error);
		},
	});

	const removeRole = api.admin.roles.userRemove.useMutation({
		onSuccess: invalidateUser,
		onError: (error) => {
			toastMutationError("Could not remove the role", error);
		},
	});

	const grantPermission = api.admin.permissions.userGrant.useMutation({
		onSuccess: invalidateUser,
		onError: (error) => {
			toastMutationError("Could not grant the permission", error);
		},
	});

	const revokePermission = api.admin.permissions.userRevoke.useMutation({
		onSuccess: invalidateUser,
		onError: (error) => {
			toastMutationError("Could not revoke the permission", error);
		},
	});

	const checkPermission = api.admin.permissions.check.useMutation({
		onSuccess: (resp) => {
			setCheckResult(resp.data);
		},
		onError: (error) => {
			setCheckResult(null);
			toastMutationError("Could not check the permission", error);
		},
	});

	const assignedRoleIds: ReadonlySet<string> = React.useMemo((): ReadonlySet<string> => new Set<string>(user.roles.map((role) => role.id)), [user.roles]);
	const directPermissionIds: Set<string> = new Set<string>(user.directPermissionIds);

	// The user's own permissions hold every direct grant, so the read-only tree needs no catalog page.
	const directGrants = user.permissions.filter((perm) => directPermissionIds.has(perm.id));
	const catalogPermissionTree = buildPermissionTree(grantsQuery.data?.data ?? []);
	const directGrantTree = buildPermissionTree(directGrants);
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

	const handleAssignRoleChange = React.useCallback((value: string): void => {
		setAssignRoleId(value);
	}, []);

	const handleAssignRoleClick = React.useCallback((): void => {
		if (assignRoleId.length > 0) {
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

	const handleCheck = React.useCallback(
		(input: CheckPermissionInput): void => {
			checkPermission.mutate(input);
		},
		[checkPermission],
	);

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
					{grantsQuery.isError ? <p className="text-sm text-destructive">Could not load the permission catalog. Check LIST:PERMISSION permission and refresh.</p> : null}

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
										onRemove={canManageRoles ? roleRemoveHandlers[role.id] : undefined}
										removeDisabled={removeRole.isPending}
									/>
								))}
							</div>
							{canManageRoles ? (
								<div className="flex flex-wrap items-end gap-3 border-t border-dashed pt-4">
									<div className="min-w-[200px] flex-1 space-y-1">
										<Label htmlFor="assign-role">Add role</Label>
										<RolePicker id="assign-role" value={assignRoleId} onChange={handleAssignRoleChange} excludedRoleIds={assignedRoleIds} enabled={canListRoles} />
									</div>
									<UserDetailButton type="button" disabled={assignRoleId.length === 0 || assignRole.isPending} onClick={handleAssignRoleClick}>
										Assign role
									</UserDetailButton>
								</div>
							) : (
								<AccessRestrictedNotice description="Assigning or removing roles requires the role update permission." />
							)}
						</TabsContent>

						<TabsContent value="direct-grants" className="mt-4 space-y-4">
							{canManageDirectGrants ? (
								<>
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
									{grantsPager.isPaged ? (
										<ListPager
											page={grantsPager.page}
											totalPages={grantsPager.totalPages}
											hasPrevious={grantsPager.hasPrevious}
											hasNext={grantsPager.hasNext}
											onPrevious={grantsPager.onPrevious}
											onNext={grantsPager.onNext}
											disabled={grantsQuery.isPlaceholderData}
										/>
									) : null}
								</>
							) : (
								<>
									<AccessRestrictedNotice description="Granting or revoking direct permissions requires the permission update permission." />
									<AccessPermissionTree groups={directGrantTree} emptyMessage="No direct permission grants." defaultOpen={false} />
								</>
							)}
						</TabsContent>

						<TabsContent value="effective" className="mt-4 space-y-4">
							<p className="text-sm text-muted-foreground">Union of role-based and direct grants. Expand a category to browse actions.</p>
							<AccessPermissionTree groups={effectivePermissionTree} emptyMessage="No effective permissions." defaultOpen={false} />
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{canCheckPermissions ? (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Permission checker</CardTitle>
						<CardDescription>
							Inspect why this user has or lacks a permission. Seed roles are flat — customer User accounts only get customer-app permissions unless you assign staff roles or
							direct grants.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<PermissionCheckForm userId={userId} idPrefix="check" isPending={checkPermission.isPending} onCheck={handleCheck} submitLabel="Run check" />
						{checkResult !== null ? <PermissionCheckResult result={checkResult} /> : null}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
