"use client";

import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import { AccessExpiry, TeamBackLink } from "@/contexts/tenancy/components/access/access-parts";
import { MerchantAccessDenied, MerchantCapabilityGate } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { ACCESS_DURATION_OPTIONS, AccessDurationSchema, resolveExpiresAt, type AccessDuration } from "@/contexts/tenancy/lib/access/grant-duration";
import { permissionKey, permissionLabel, TENANT_PERMISSION_GROUPS } from "@/contexts/tenancy/lib/access/permission-labels";
import { resolveActiveLocations } from "@/contexts/tenancy/lib/tenant/location-access";
import { tenantRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	MERCHANT_CAPABILITY,
	type LocationResponse,
	type PermissionPair,
	type TenantGrantResponse,
	type TenantMemberAccessResponse,
	type TenantRoleResponse,
} from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const ROLE_CHANGE_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Change role", loading: "Changing…" };
const REVOKE_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Take it back", loading: "Taking back…" };
const REMOVE_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Remove from team", loading: "Removing…" };
/** The store select's value for "every store" (a grant with no store). */
const EVERY_STORE = "every-store";
/** The zone a tenant is assumed to run in until its context loads (only absolute times use it). */
const FALLBACK_TIME_ZONE = "UTC";

export interface TeamMemberAccessPageViewProps {
	readonly tenantSlug: string;
	readonly membershipId: string;
}

/** One member's access (`/settings/team/members/[membershipId]`): their role, extra permissions on top, removal. */
export function TeamMemberAccessPageView({ tenantSlug, membershipId }: TeamMemberAccessPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageTeam}
			fallback={
				<div className="space-y-8">
					<SettingsSectionHeader title="Member access" description="Their role and any extra permissions." />
					<MerchantAccessDenied title="Team access required" description="Your role can't manage team members. Contact your store owner if you need access." />
				</div>
			}>
			<MemberAccess tenantSlug={tenantSlug} membershipId={membershipId} />
		</MerchantCapabilityGate>
	);
}

/** The store a grant is limited to, by name ("Every store" when none). */
export function grantStoreLabel(locationId: string | null, locations: readonly Pick<LocationResponse, "id" | "name">[]): string {
	if (locationId === null) {
		return "Every store";
	}
	return locations.find((location) => location.id === locationId)?.name ?? "A closed store";
}

function MemberAccess({ tenantSlug, membershipId }: TeamMemberAccessPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const memberQuery = api.tenantAccess.member.useQuery({ tenantSlug, membershipId });
	const rolesQuery = api.tenantAccess.roles.useQuery({ tenantSlug });
	const contextQuery = api.tenants.context.useQuery({ tenantSlug });
	const member = memberQuery.data?.data;

	if (memberQuery.isLoading) {
		return (
			<div aria-busy="true" aria-label="Loading member" className="space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-40 w-full rounded-xl" />
				<Skeleton className="h-56 w-full rounded-xl" />
			</div>
		);
	}
	if (member === undefined) {
		return <MerchantAccessDenied title="Member not found" description="This person left the team or was never a member of this business." />;
	}
	const context = contextQuery.data?.data;
	return (
		<div className="space-y-6">
			<SettingsSectionHeader title={member.fullName} description={member.email} />
			<TeamBackLink tenantSlug={tenantSlug} tab="members" />
			<MemberRoleCard tenantSlug={tenantSlug} member={member} roles={rolesQuery.data?.data ?? []} locations={context === undefined ? [] : resolveActiveLocations(context)} />
			<MemberGrantsCard
				tenantSlug={tenantSlug}
				member={member}
				locations={context === undefined ? [] : resolveActiveLocations(context)}
				timeZone={context?.tenant.timeZone ?? FALLBACK_TIME_ZONE}
			/>
			<RemoveMemberCard tenantSlug={tenantSlug} member={member} />
		</div>
	);
}

// ── Role ───────────────────────────────────────────────────────────────

interface MemberRoleCardProps {
	readonly tenantSlug: string;
	readonly member: TenantMemberAccessResponse;
	readonly roles: readonly TenantRoleResponse[];
	readonly locations: readonly LocationResponse[];
}

function MemberRoleCard({ tenantSlug, member, roles, locations }: MemberRoleCardProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [roleId, setRoleId] = React.useState<string>(member.roleId);
	const [confirming, setConfirming] = React.useState<boolean>(false);
	const options: readonly SelectOption<string>[] = roles.map((role) => ({ value: role.id, label: role.name }));
	const chosen = roles.find((role) => role.id === roleId);
	const storesLabel =
		member.locationScopeType === "ALL_LOCATIONS" ? "Every store, including new ones" : member.locationIds.map((id) => grantStoreLabel(id, locations)).join(", ");

	const changeMutation = api.tenantAccess.changeMemberRole.useMutation({
		onSuccess: async (): Promise<void> => {
			setConfirming(false);
			toastMessage.success({ title: `Role changed to ${chosen?.name ?? "the new role"}` });
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.tenantAccess.roles.scopeKey({ tenantSlug }) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.tenants.listMembers.scopeKey({ tenantSlug }) }),
			]);
		},
	});

	const handleRoleChange = React.useCallback((value: string | null): void => {
		if (value !== null) {
			setRoleId(value);
		}
	}, []);
	const openConfirm = React.useCallback((): void => {
		changeMutation.reset();
		setConfirming(true);
	}, [changeMutation]);
	const handleDialogChange = React.useCallback((open: boolean): void => {
		setConfirming(open);
	}, []);
	const confirm = React.useCallback((): void => {
		changeMutation.mutate({ tenantSlug, membershipId: member.membershipId, roleId });
	}, [changeMutation, member.membershipId, roleId, tenantSlug]);

	return (
		<Card className="gap-4 p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-base font-semibold text-foreground">Role</h2>
				<Badge variant="secondary">{member.roleName}</Badge>
			</div>
			<p className="text-sm text-muted-foreground">Stores: {storesLabel}</p>
			<div className="flex flex-wrap items-end gap-3">
				<div className="w-full max-w-xs space-y-2">
					<Label htmlFor="member-role">Change role to</Label>
					<Select items={options} value={roleId} onValueChange={handleRoleChange} disabled={changeMutation.isPending}>
						<SelectTrigger id="member-role">
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
				</div>
				<Button type="button" variant="outline" onClick={openConfirm} disabled={roleId === member.roleId}>
					Change role
				</Button>
			</div>
			<AlertDialog open={confirming} onOpenChange={handleDialogChange}>
				<AlertDialogContent align="start" actionOrder="cancel-first" labels={ROLE_CHANGE_LABELS} confirmLoading={changeMutation.isPending} onConfirm={confirm}>
					<AlertDialogTitle>
						Make {member.fullName} a {chosen?.name ?? "new role"}?
					</AlertDialogTitle>
					<AlertDialogDescription>Their permissions change at once. Extra permissions they were given stay until they end.</AlertDialogDescription>
					<InlineError error={changeMutation.error} />
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

// ── Extra permissions ──────────────────────────────────────────────────

interface MemberGrantsCardProps {
	readonly tenantSlug: string;
	readonly member: TenantMemberAccessResponse;
	readonly locations: readonly LocationResponse[];
	readonly timeZone: string;
}

function MemberGrantsCard({ tenantSlug, member, locations, timeZone }: MemberGrantsCardProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const grantsQuery = api.tenantAccess.memberGrants.useQuery({ tenantSlug, membershipId: member.membershipId });
	const grants = grantsQuery.data?.data ?? [];
	const [toRevoke, setToRevoke] = React.useState<TenantGrantResponse | null>(null);

	const refresh = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.tenantAccess.memberGrants.scopeKey({ tenantSlug, membershipId: member.membershipId }) });
	}, [member.membershipId, queryClient, tenantSlug]);
	const revokeMutation = api.tenantAccess.revokeGrant.useMutation({
		onSuccess: async (): Promise<void> => {
			setToRevoke(null);
			toastMessage.success({ title: "Permission taken back" });
			await refresh();
		},
	});

	const handleDialogChange = React.useCallback((open: boolean): void => {
		if (!open) {
			setToRevoke(null);
		}
	}, []);
	const askRevoke = React.useCallback(
		(grant: TenantGrantResponse): void => {
			revokeMutation.reset();
			setToRevoke(grant);
		},
		[revokeMutation],
	);
	const confirmRevoke = React.useCallback((): void => {
		if (toRevoke !== null) {
			revokeMutation.mutate({ tenantSlug, grantId: toRevoke.id });
		}
	}, [revokeMutation, tenantSlug, toRevoke]);

	return (
		<Card className="gap-4 p-6">
			<div className="space-y-1">
				<h2 className="text-base font-semibold text-foreground">Extra permissions</h2>
				<p className="text-sm text-muted-foreground">On top of their role — for a while or for good. You can only give what your own role has, in your own stores.</p>
			</div>
			{grantsQuery.isLoading ? (
				<Skeleton aria-label="Loading extra permissions" className="h-16 w-full rounded-lg" />
			) : grants.length === 0 ? (
				<p className="text-sm text-muted-foreground">No extra permissions. Their role decides everything they can do.</p>
			) : (
				<ul className="space-y-3">
					{grants.map((grant) => (
						<GrantRow key={grant.id} grant={grant} storeLabel={grantStoreLabel(grant.locationId, locations)} timeZone={timeZone} onRevoke={askRevoke} />
					))}
				</ul>
			)}
			<GiveGrantForm tenantSlug={tenantSlug} membershipId={member.membershipId} locations={locations} timeZone={timeZone} onGiven={refresh} />
			<AlertDialog open={toRevoke !== null} onOpenChange={handleDialogChange}>
				<AlertDialogContent align="start" actionOrder="cancel-first" labels={REVOKE_LABELS} confirmLoading={revokeMutation.isPending} onConfirm={confirmRevoke}>
					<AlertDialogTitle>Take back “{toRevoke === null ? "" : permissionLabel(toRevoke.permission)}”?</AlertDialogTitle>
					<AlertDialogDescription>{member.fullName} loses it at once. Their role is not affected.</AlertDialogDescription>
					<InlineError error={revokeMutation.error} />
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

interface GrantRowProps {
	readonly grant: TenantGrantResponse;
	readonly storeLabel: string;
	readonly timeZone: string;
	readonly onRevoke: (grant: TenantGrantResponse) => void;
}

function GrantRow({ grant, storeLabel, timeZone, onRevoke }: GrantRowProps): React.JSX.Element {
	const handleRevoke = React.useCallback((): void => {
		onRevoke(grant);
	}, [grant, onRevoke]);
	return (
		<li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0 space-y-1">
				<p className="font-medium text-foreground">{permissionLabel(grant.permission)}</p>
				<p className="text-sm text-muted-foreground">
					{storeLabel}
					{grant.grantedVia === null ? null : <> · given by a {grant.grantedVia}</>}
				</p>
				<AccessExpiry expiresAt={grant.expiresAt} timeZone={timeZone} />
			</div>
			<Button type="button" variant="outline" size="sm" onClick={handleRevoke}>
				Take back
			</Button>
		</li>
	);
}

interface GiveGrantFormProps {
	readonly tenantSlug: string;
	readonly membershipId: string;
	readonly locations: readonly LocationResponse[];
	readonly timeZone: string;
	readonly onGiven: () => Promise<void>;
}

const PERMISSION_OPTIONS: readonly SelectOption<string>[] = TENANT_PERMISSION_GROUPS.flatMap((group) =>
	group.permissions.map((permission) => ({ value: permissionKey(permission), label: permissionLabel(permission) })),
);

function permissionFromKey(key: string): PermissionPair | undefined {
	return TENANT_PERMISSION_GROUPS.flatMap((group) => group.permissions).find((permission) => permissionKey(permission) === key);
}

/** Give one permission: which, at which store, for how long (24 h / 48 h / 7 days / until a date / permanent). */
function GiveGrantForm({ tenantSlug, membershipId, locations, timeZone, onGiven }: GiveGrantFormProps): React.JSX.Element {
	const { api } = useAuth();
	const [permission, setPermission] = React.useState<string>("");
	const [store, setStore] = React.useState<string>(EVERY_STORE);
	const [duration, setDuration] = React.useState<AccessDuration>("48h");
	const [untilDate, setUntilDate] = React.useState<string>("");
	const [error, setError] = React.useState<string | null>(null);
	const storeOptions: readonly SelectOption<string>[] = [
		{ value: EVERY_STORE, label: "Every store" },
		...locations.map((location) => ({ value: location.id, label: location.name })),
	];

	const grantMutation = api.tenantAccess.grant.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Permission given" });
			setPermission("");
			setError(null);
			await onGiven();
		},
		onError: (mutationError): void => {
			setError(resolveAuthErrorMessage(mutationError));
		},
	});

	const handlePermission = React.useCallback((value: string | null): void => {
		setPermission(value ?? "");
	}, []);
	const handleStore = React.useCallback((value: string | null): void => {
		setStore(value ?? EVERY_STORE);
	}, []);
	const handleDuration = React.useCallback((value: string | null): void => {
		const parsed = AccessDurationSchema.safeParse(value);
		if (parsed.success) {
			setDuration(parsed.data);
		}
	}, []);

	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const chosen = permissionFromKey(permission);
			if (chosen === undefined) {
				setError("Choose a permission to give.");
				return;
			}
			const expiry = resolveExpiresAt(duration, Date.now(), untilDate, timeZone);
			if (!expiry.ok) {
				setError(expiry.message);
				return;
			}
			setError(null);
			grantMutation.mutate({
				tenantSlug,
				membershipId,
				permission: chosen,
				...(store === EVERY_STORE ? {} : { locationId: store }),
				...(expiry.expiresAt === undefined ? {} : { expiresAt: expiry.expiresAt }),
			});
		},
		[duration, grantMutation, membershipId, permission, store, tenantSlug, timeZone, untilDate],
	);

	return (
		<form className="space-y-4 rounded-xl border border-border bg-background/60 p-4" onSubmit={handleSubmit} noValidate>
			<h3 className="text-sm font-semibold text-foreground">Give a permission</h3>
			<div className="grid gap-4 sm:grid-cols-3">
				<div className="space-y-2">
					<Label htmlFor="grant-permission">Permission</Label>
					<Select items={PERMISSION_OPTIONS} value={permission === "" ? null : permission} onValueChange={handlePermission} disabled={grantMutation.isPending}>
						<SelectTrigger id="grant-permission">
							<SelectValue placeholder="Choose a permission" />
						</SelectTrigger>
						<SelectContent>
							{TENANT_PERMISSION_GROUPS.map((group) => (
								<SelectGroup key={group.resource}>
									<SelectLabel>{group.label}</SelectLabel>
									{group.permissions.map((option) => (
										<SelectItem key={permissionKey(option)} value={permissionKey(option)}>
											{permissionLabel(option)}
										</SelectItem>
									))}
								</SelectGroup>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="grant-store">Where</Label>
					<Select items={storeOptions} value={store} onValueChange={handleStore} disabled={grantMutation.isPending}>
						<SelectTrigger id="grant-store">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{storeOptions.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="grant-duration">For how long</Label>
					<Select items={ACCESS_DURATION_OPTIONS} value={duration} onValueChange={handleDuration} disabled={grantMutation.isPending}>
						<SelectTrigger id="grant-duration">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ACCESS_DURATION_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
			{duration === "custom" ? (
				<div className="max-w-xs space-y-2">
					<Label htmlFor="grant-until">Last day</Label>
					<DatePicker id="grant-until" value={untilDate} onValueChange={setUntilDate} placeholder="Pick a date" disabled={grantMutation.isPending} />
				</div>
			) : null}
			{error === null ? null : (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
			<Button type="submit" disabled={grantMutation.isPending}>
				{grantMutation.isPending ? "Giving…" : "Give permission"}
			</Button>
		</form>
	);
}

// ── Removal ────────────────────────────────────────────────────────────

function RemoveMemberCard({ tenantSlug, member }: { readonly tenantSlug: string; readonly member: TenantMemberAccessResponse }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [confirming, setConfirming] = React.useState<boolean>(false);
	const removeMutation = api.tenantAccess.removeMember.useMutation({
		onSuccess: async (): Promise<void> => {
			setConfirming(false);
			toastMessage.success({ title: `${member.fullName} removed from the team` });
			await queryClient.invalidateQueries({ queryKey: apiRouter.tenants.listMembers.scopeKey({ tenantSlug }) });
			router.push(tenantRoutes(tenantSlug).settings.team);
		},
	});
	const open = React.useCallback((): void => {
		removeMutation.reset();
		setConfirming(true);
	}, [removeMutation]);
	const confirm = React.useCallback((): void => {
		removeMutation.mutate({ tenantSlug, membershipId: member.membershipId });
	}, [member.membershipId, removeMutation, tenantSlug]);

	return (
		<Card className="gap-3 border-destructive/30 p-6">
			<h2 className="text-base font-semibold text-foreground">Remove from team</h2>
			<p className="text-sm text-muted-foreground">They lose their role, extra permissions and anything shared with them, at once.</p>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="button" variant="destructive" onClick={open}>
					Remove {member.fullName}
				</Button>
				<Link href={tenantRoutes(tenantSlug).settings.team} className="text-sm text-muted-foreground hover:text-foreground">
					Back to the team
				</Link>
			</div>
			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent severity="critical" align="start" actionOrder="cancel-first" labels={REMOVE_LABELS} confirmLoading={removeMutation.isPending} onConfirm={confirm}>
					<AlertDialogTitle>Remove {member.fullName} from the team?</AlertDialogTitle>
					<AlertDialogDescription>They can&apos;t sign in to this business any more. Invite them again to bring them back.</AlertDialogDescription>
					<InlineError error={removeMutation.error} />
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

function InlineError({ error }: { readonly error: Error | null }): React.JSX.Element | null {
	return error === null ? null : (
		<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
			{resolveAuthErrorMessage(error)}
		</p>
	);
}
