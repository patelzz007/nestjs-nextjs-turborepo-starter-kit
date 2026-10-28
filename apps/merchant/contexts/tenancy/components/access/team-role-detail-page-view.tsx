"use client";

import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import { PermissionSummary, TeamBackLink } from "@/contexts/tenancy/components/access/access-parts";
import { MerchantAccessDenied, MerchantCapabilityGate } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { roleCountsLabel, roleOriginLabel } from "@/contexts/tenancy/components/access/team-roles-page-view";
import { tenantRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { ApiError } from "@workspace/client/lib/api/use-api";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { ApiErrorCodes, MERCHANT_CAPABILITY, type TenantRoleHolders, type TenantRoleResponse } from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const RESET_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Reset role", loading: "Resetting…" };
const DELETE_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Delete role", loading: "Deleting…" };
const REASSIGN_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Move members and delete", loading: "Moving…" };

/** The API refused because members still hold the role (409): they need a new role first. */
export function isRoleInUseError(error: Error | null): boolean {
	return error instanceof ApiError && error.code === ApiErrorCodes.CONFLICT;
}

export interface TeamRoleDetailPageViewProps {
	readonly tenantSlug: string;
	readonly roleId: string;
}

/** One role, read-only: what it gives and who holds it, with edit, reset and delete (`/settings/team/roles/[roleId]`). */
export function TeamRoleDetailPageView({ tenantSlug, roleId }: TeamRoleDetailPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageTeam}
			fallback={
				<div className="space-y-8">
					<SettingsSectionHeader title="Role" description="What members holding this role can do." />
					<MerchantAccessDenied title="Team access required" description="Your role can't view or manage roles. Contact your store owner if you need access." />
				</div>
			}>
			<TeamRoleDetail tenantSlug={tenantSlug} roleId={roleId} />
		</MerchantCapabilityGate>
	);
}

function TeamRoleDetail({ tenantSlug, roleId }: TeamRoleDetailPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const rolesQuery = api.tenantAccess.roles.useQuery({ tenantSlug });
	const roles = rolesQuery.data?.data ?? [];
	const role = roles.find((candidate) => candidate.id === roleId);

	if (rolesQuery.isLoading) {
		return (
			<div aria-busy="true" aria-label="Loading role" className="space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-48 w-full rounded-xl" />
			</div>
		);
	}
	if (role === undefined) {
		return <MerchantAccessDenied title="Role not found" description="This role was deleted or never existed in this business." />;
	}
	return <TeamRoleDetailContent tenantSlug={tenantSlug} role={role} otherRoles={roles.filter((candidate) => candidate.id !== role.id)} />;
}

interface TeamRoleDetailContentProps {
	readonly tenantSlug: string;
	readonly role: TenantRoleResponse;
	readonly otherRoles: readonly TenantRoleResponse[];
}

function TeamRoleDetailContent({ tenantSlug, role, otherRoles }: TeamRoleDetailContentProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();
	const routes = tenantRoutes(tenantSlug).settings.teamRoles;
	const isOwnerRole = role.templateKey === "OWNER";
	const [dialog, setDialog] = React.useState<"reset" | "delete" | "reassign" | null>(null);

	const refreshRoles = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.tenantAccess.roles.scopeKey({ tenantSlug }) });
	}, [queryClient, tenantSlug]);

	const resetMutation = api.tenantAccess.resetRole.useMutation({
		onSuccess: async (): Promise<void> => {
			setDialog(null);
			toastMessage.success({ title: "Role reset to its standard permissions" });
			await refreshRoles();
		},
	});
	const deleteMutation = api.tenantAccess.deleteRole.useMutation({
		onSuccess: async (): Promise<void> => {
			setDialog(null);
			toastMessage.success({ title: "Role deleted" });
			await refreshRoles();
			router.push(routes.list);
		},
		onError: (error): void => {
			if (isRoleInUseError(error)) {
				setDialog("reassign");
			}
		},
	});

	const handleDialogChange = React.useCallback((open: boolean): void => {
		if (!open) {
			setDialog(null);
		}
	}, []);
	const openReset = React.useCallback((): void => {
		resetMutation.reset();
		setDialog("reset");
	}, [resetMutation]);
	const openDelete = React.useCallback((): void => {
		deleteMutation.reset();
		setDialog("delete");
	}, [deleteMutation]);
	const confirmReset = React.useCallback((): void => {
		resetMutation.mutate({ tenantSlug, roleId: role.id });
	}, [resetMutation, role.id, tenantSlug]);
	const confirmDelete = React.useCallback((): void => {
		deleteMutation.mutate({ tenantSlug, roleId: role.id });
	}, [deleteMutation, role.id, tenantSlug]);
	const afterReassign = React.useCallback((): void => {
		deleteMutation.mutate({ tenantSlug, roleId: role.id });
	}, [deleteMutation, role.id, tenantSlug]);

	return (
		<div className="space-y-6">
			<SettingsSectionHeader
				title={role.name}
				description={isOwnerRole ? "The Owner role always holds every permission, so the business can never lock itself out." : "What members holding this role can do."}
				action={
					isOwnerRole ? undefined : (
						<>
							<Link href={routes.edit(role.id)} className={buttonVariants()}>
								Edit role
							</Link>
							{role.templateKey === null ? null : (
								<Button type="button" variant="outline" onClick={openReset}>
									Reset to standard
								</Button>
							)}
							<Button type="button" variant="destructive" onClick={openDelete}>
								Delete
							</Button>
						</>
					)
				}
			/>
			<TeamBackLink tenantSlug={tenantSlug} tab="roles" />

			<Card className="gap-4 p-6">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant={role.templateKey === null ? "outline" : "secondary"}>{roleOriginLabel(role)}</Badge>
					<span className="text-sm text-muted-foreground">{roleCountsLabel(role)}</span>
				</div>
				<PermissionSummary permissions={role.permissions} />
			</Card>

			<Link href={routes.list} className="text-sm text-muted-foreground hover:text-foreground">
				All roles
			</Link>

			<AlertDialog open={dialog === "reset"} onOpenChange={handleDialogChange}>
				<AlertDialogContent align="start" actionOrder="cancel-first" labels={RESET_LABELS} confirmLoading={resetMutation.isPending} onConfirm={confirmReset}>
					<AlertDialogTitle>Reset “{role.name}” to its standard permissions?</AlertDialogTitle>
					<AlertDialogDescription>Your changes to this role are replaced. Everyone holding it gets the standard permissions at once.</AlertDialogDescription>
					<DialogError error={resetMutation.error} />
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={dialog === "delete"} onOpenChange={handleDialogChange}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={DELETE_LABELS}
					confirmLoading={deleteMutation.isPending}
					onConfirm={confirmDelete}>
					<AlertDialogTitle>Delete “{role.name}”?</AlertDialogTitle>
					<AlertDialogDescription>
						{role.holderCount === 0 ? "No one holds this role." : "Members holding this role will need a new one — you'll choose it next."}
					</AlertDialogDescription>
					{isRoleInUseError(deleteMutation.error) ? null : <DialogError error={deleteMutation.error} />}
				</AlertDialogContent>
			</AlertDialog>

			{dialog === "reassign" ? (
				<ReassignHoldersDialog
					tenantSlug={tenantSlug}
					role={role}
					otherRoles={otherRoles}
					deleting={deleteMutation.isPending}
					onClose={handleDialogChange}
					onReassigned={afterReassign}
				/>
			) : null}
		</div>
	);
}

function DialogError({ error }: { readonly error: Error | null }): React.JSX.Element | null {
	return error === null ? null : (
		<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
			{resolveAuthErrorMessage(error)}
		</p>
	);
}

interface ReassignHoldersDialogProps {
	readonly tenantSlug: string;
	readonly role: TenantRoleResponse;
	readonly otherRoles: readonly TenantRoleResponse[];
	readonly deleting: boolean;
	readonly onClose: (open: boolean) => void;
	readonly onReassigned: () => void;
}

/**
 * Members still hold the role: choose a new role for each, moved in one step against the holder list the
 * dialog loaded (if anyone joined or left the role meanwhile, the API refuses and the list reloads).
 */
function ReassignHoldersDialog({ tenantSlug, role, otherRoles, deleting, onClose, onReassigned }: ReassignHoldersDialogProps): React.JSX.Element {
	const { api } = useAuth();
	const holdersQuery = api.tenantAccess.roleHolders.useQuery({ tenantSlug, roleId: role.id });
	const holders = React.useMemo((): TenantRoleHolders["holders"] => holdersQuery.data?.data.holders ?? [], [holdersQuery.data]);
	// Owners are made from the Owner role's own page, never by deleting another role.
	const options: readonly SelectOption<string>[] = otherRoles
		.filter((candidate) => candidate.templateKey !== "OWNER")
		.map((candidate) => ({ value: candidate.id, label: candidate.name }));
	const fallbackRoleId = options.at(-1)?.value ?? "";
	const [choices, setChoices] = React.useState<Readonly<Record<string, string>>>({});

	const reassignMutation = api.tenantAccess.reassignHolders.useMutation({
		onSuccess: (): void => {
			onReassigned();
		},
		onError: (error): void => {
			if (isRoleInUseError(error)) {
				void holdersQuery.refetch();
			}
		},
	});

	const choose = React.useCallback((membershipId: string, roleId: string | null): void => {
		if (roleId !== null) {
			setChoices((current) => ({ ...current, [membershipId]: roleId }));
		}
	}, []);
	const confirm = React.useCallback((): void => {
		const version = holdersQuery.data?.data.holdersVersion;
		if (version === undefined) {
			return;
		}
		reassignMutation.mutate({
			tenantSlug,
			roleId: role.id,
			holdersVersion: version,
			assignments: holders.map((holder) => ({ membershipId: holder.membershipId, roleId: choices[holder.membershipId] ?? fallbackRoleId })),
		});
	}, [choices, fallbackRoleId, holders, holdersQuery.data, reassignMutation, role.id, tenantSlug]);

	return (
		<AlertDialog open onOpenChange={onClose}>
			<AlertDialogContent
				align="start"
				actionOrder="cancel-first"
				labels={REASSIGN_LABELS}
				confirmLoading={reassignMutation.isPending || deleting || holdersQuery.isLoading}
				onConfirm={confirm}>
				<AlertDialogTitle>Choose a new role for {holders.length === 1 ? "this member" : "these members"}</AlertDialogTitle>
				<AlertDialogDescription>“{role.name}” can be deleted once no one holds it. Each member below moves to the role you choose.</AlertDialogDescription>
				<ul className="max-h-72 space-y-3 overflow-y-auto">
					{holders.map((holder) => (
						<li key={holder.membershipId} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
							<Label htmlFor={`reassign-${holder.membershipId}`} className="min-w-0 flex-col items-start gap-0">
								<span className="truncate font-medium text-foreground">{holder.fullName}</span>
								<span className="truncate text-xs text-muted-foreground">{holder.email}</span>
							</Label>
							<HolderRoleSelect membershipId={holder.membershipId} value={choices[holder.membershipId] ?? fallbackRoleId} options={options} onChoose={choose} />
						</li>
					))}
				</ul>
				<DialogError
					error={isRoleInUseError(reassignMutation.error) ? new Error("The members holding this role changed — check the list and try again.") : reassignMutation.error}
				/>
			</AlertDialogContent>
		</AlertDialog>
	);
}

interface HolderRoleSelectProps {
	readonly membershipId: string;
	readonly value: string;
	readonly options: readonly SelectOption<string>[];
	readonly onChoose: (membershipId: string, roleId: string | null) => void;
}

function HolderRoleSelect({ membershipId, value, options, onChoose }: HolderRoleSelectProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(next: string | null): void => {
			onChoose(membershipId, next);
		},
		[membershipId, onChoose],
	);
	return (
		<Select items={options} value={value} onValueChange={handleChange}>
			<SelectTrigger id={`reassign-${membershipId}`}>
				<SelectValue placeholder="Choose a role" />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
