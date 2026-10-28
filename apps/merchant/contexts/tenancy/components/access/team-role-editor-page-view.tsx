"use client";

import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import { PermissionChecklist } from "@/contexts/tenancy/components/access/access-parts";
import { MerchantAccessDenied, MerchantCapabilityGate } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { samePermission } from "@/contexts/tenancy/lib/access/permission-labels";
import { tenantRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_SLOT_INDEX, MERCHANT_CAPABILITY, TenantRoleCreateSchema, type PermissionPair, type TenantRoleResponse } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface TeamRoleEditorPageViewProps {
	readonly tenantSlug: string;
	/** The role to edit; omitted for a new role. */
	readonly roleId?: string;
}

/** A new role, or the editor of one (`/settings/team/roles/new`, `…/[roleId]/edit`). The Owner role is never edited. */
export function TeamRoleEditorPageView({ tenantSlug, roleId }: TeamRoleEditorPageViewProps): React.JSX.Element {
	const title = roleId === undefined ? "New role" : "Edit role";
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageTeam}
			fallback={
				<div className="space-y-8">
					<SettingsSectionHeader title={title} description="Choose what members holding this role can do." />
					<MerchantAccessDenied title="Team access required" description="Your role can't manage roles. Contact your store owner if you need access." />
				</div>
			}>
			{roleId === undefined ? <RoleEditorForm tenantSlug={tenantSlug} existing={null} /> : <ExistingRoleEditor tenantSlug={tenantSlug} roleId={roleId} />}
		</MerchantCapabilityGate>
	);
}

function ExistingRoleEditor({ tenantSlug, roleId }: { readonly tenantSlug: string; readonly roleId: string }): React.JSX.Element {
	const { api } = useAuth();
	const rolesQuery = api.tenantAccess.roles.useQuery({ tenantSlug });
	const role = rolesQuery.data?.data.find((candidate) => candidate.id === roleId);
	const backHref = tenantRoutes(tenantSlug).settings.teamRoles.detail(roleId);

	if (rolesQuery.isLoading) {
		return (
			<div aria-busy="true" aria-label="Loading role" className="space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-64 w-full rounded-xl" />
			</div>
		);
	}
	if (role === undefined) {
		return <MerchantAccessDenied title="Role not found" description="This role was deleted or never existed in this business." />;
	}
	if (role.templateKey === "OWNER") {
		return (
			<div className="space-y-6">
				<SettingsSectionHeader title="Edit role" description="The Owner role always holds every permission." />
				<MerchantAccessDenied title="The Owner role can't be changed" description="It always holds every permission, so the business can never lock itself out." />
				<Link href={backHref} className={buttonVariants({ variant: "outline" })}>
					Back to the role
				</Link>
			</div>
		);
	}
	return <RoleEditorForm tenantSlug={tenantSlug} existing={role} />;
}

interface RoleEditorFormProps {
	readonly tenantSlug: string;
	/** The role being edited, or `null` for a new one. */
	readonly existing: TenantRoleResponse | null;
}

function RoleEditorForm({ tenantSlug, existing: role }: RoleEditorFormProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();
	const routes = tenantRoutes(tenantSlug).settings.teamRoles;
	const [name, setName] = React.useState<string>(role?.name ?? "");
	const [permissions, setPermissions] = React.useState<readonly PermissionPair[]>(role?.permissions ?? []);
	const [error, setError] = React.useState<string | null>(null);

	const onSaved = React.useCallback(
		async (saved: TenantRoleResponse): Promise<void> => {
			toastMessage.success({ title: role === null ? "Role created" : "Role saved" });
			await queryClient.invalidateQueries({ queryKey: apiRouter.tenantAccess.roles.scopeKey({ tenantSlug }) });
			router.push(routes.detail(saved.id));
		},
		[queryClient, role, router, routes, tenantSlug],
	);
	const onFailed = React.useCallback((mutationError: Error): void => {
		setError(resolveAuthErrorMessage(mutationError));
	}, []);
	const createMutation = api.tenantAccess.createRole.useMutation({ onSuccess: (result): Promise<void> => onSaved(result.data), onError: onFailed });
	const updateMutation = api.tenantAccess.updateRole.useMutation({ onSuccess: (result): Promise<void> => onSaved(result.data), onError: onFailed });
	const isSaving = createMutation.isPending || updateMutation.isPending;

	const handleNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);
	const handleToggle = React.useCallback((permission: PermissionPair, checked: boolean): void => {
		setPermissions((current) => (checked ? [...current, permission] : current.filter((held) => !samePermission(held, permission))));
	}, []);

	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			// The same schema the API validates with (client validation is for the user only).
			const parsed = TenantRoleCreateSchema.safeParse({ name, permissions });
			if (!parsed.success) {
				setError(parsed.error.issues[LIST_SLOT_INDEX.first]?.message ?? "Give the role a name.");
				return;
			}
			if (role === null) {
				createMutation.mutate({ tenantSlug, ...parsed.data });
			} else {
				updateMutation.mutate({ tenantSlug, roleId: role.id, ...parsed.data });
			}
		},
		[createMutation, name, permissions, role, tenantSlug, updateMutation],
	);

	return (
		<form className="space-y-6" onSubmit={handleSubmit} noValidate>
			<SettingsSectionHeader
				title={role === null ? "New role" : `Edit ${role.name}`}
				description="Choose what members holding this role can do. You can only give permissions your own role has."
			/>
			<Card className="gap-4 p-6">
				<div className="max-w-sm space-y-2">
					<Label htmlFor="role-name">Role name</Label>
					<Input id="role-name" value={name} onChange={handleNameChange} disabled={isSaving} maxLength={100} autoComplete="off" />
				</div>
				<div className="space-y-3">
					<h2 className="text-sm font-semibold text-foreground">Permissions</h2>
					<PermissionChecklist idPrefix="role-permission" selected={permissions} onToggle={handleToggle} disabled={isSaving} />
				</div>
				{error === null ? null : (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" disabled={isSaving}>
						{isSaving ? "Saving…" : role === null ? "Create role" : "Save role"}
					</Button>
					<Link href={role === null ? routes.list : routes.detail(role.id)} className={buttonVariants({ variant: "ghost" })}>
						Cancel
					</Link>
				</div>
			</Card>
		</form>
	);
}
