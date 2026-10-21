"use client";

import {
	MerchantTeamPageSkeleton,
	TEAM_INVITE_LINES,
	TEAM_INVITE_SKELETON_ROWS,
	TEAM_MEMBER_LINES,
	TEAM_MEMBER_SKELETON_ROWS,
} from "@/components/loading/merchant-page-skeletons";
import { MerchantBorderedRowsSkeleton } from "@/components/loading/merchant-skeleton-parts";
import { MerchantAccessDenied, MerchantCapabilityGate } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { resolveActiveLocations } from "@/contexts/tenancy/lib/tenant/location-access";
import { tenantRoutes } from "@/lib/routes";
import { TENANT_ROLE_LABELS } from "@/contexts/tenancy/lib/tenant/role-labels";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useUrlListPager } from "@workspace/client/lib/url-state/use-url-list-pager";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { TEAM_INVITES_URL_STATE, TEAM_MEMBERS_URL_STATE, toTeamInvitesQuery, toTeamMembersQuery } from "@/contexts/tenancy/url-state/team";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	LIST_SLOT_INDEX,
	TenantMemberInviteFieldsSchema,
	TenantMemberInviteSchema,
	type LocationResponse,
	type LocationScopeType,
	type TenantMemberInviteResponse,
	type TenantMemberRosterResponse,
	type MembershipRole,
	MERCHANT_CAPABILITY,
} from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { toastMessage } from "@workspace/ui/components/toast";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { Card } from "@workspace/ui/components/card";
import { ListPager } from "@workspace/ui/components/list-pager";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";
import { z } from "zod";

/** What the roster announces while the members load. */
export const TEAM_MEMBERS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading team members…" };
/** What the invitations panel announces while they load. */
export const TEAM_INVITES_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading invitations…" };
/** The two pagers' landmarks, named so a screen reader tells them apart. */
const MEMBER_PAGER_LABELS: UiKitLabelsOverride<"listPager"> = { ariaLabel: "Member pages" };
const INVITE_PAGER_LABELS: UiKitLabelsOverride<"listPager"> = { ariaLabel: "Invitation pages" };

const INVITE_ROLES: readonly SelectOption<MembershipRole>[] = [
	{ value: "ADMIN", label: "Admin" },
	{ value: "MEMBER", label: "Member" },
	{ value: "CASHIER", label: "Cashier" },
	{ value: "POLICY_ADMIN", label: "Policy admin" },
];

const LOCATION_SCOPE_OPTIONS: readonly SelectOption<LocationScopeType>[] = [
	{ value: "ALL_LOCATIONS", label: "All locations" },
	{ value: "SELECTED", label: "Selected locations" },
];

type InviteFormValues = z.output<typeof TenantMemberInviteFieldsSchema>;

const DEFAULT_INVITE_VALUES: InviteFormValues = {
	email: "",
	role: "MEMBER",
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
};

function formatLocationAccess(member: Pick<TenantMemberRosterResponse, "locationScopeType" | "locationIds">, locations: readonly LocationResponse[]): string {
	if (member.locationScopeType === "ALL_LOCATIONS") {
		return "All locations";
	}

	const labels = locations.filter((location) => member.locationIds.includes(location.id)).map((location) => location.name);
	return labels.length > 0 ? labels.join(", ") : "Selected locations";
}

function formatInviteLocationAccess(invite: Pick<TenantMemberInviteResponse, "locationScopeType" | "locationIds">, locations: readonly LocationResponse[]): string {
	return formatLocationAccess(invite, locations);
}

export interface TenantTeamPageViewProps {
	readonly tenantSlug: string;
}

interface TenantTeamLocationCheckboxProps {
	readonly locationId: string;
	readonly name: string;
	readonly addressText: string | null;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly onToggle: (locationId: string, checked: boolean) => void;
}

function TenantTeamLocationCheckbox({ locationId, name, addressText, checked, disabled, onToggle }: TenantTeamLocationCheckboxProps): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(nextChecked: boolean): void => {
			onToggle(locationId, nextChecked);
		},
		[locationId, onToggle],
	);

	return (
		<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-info/40">
			<Checkbox checked={checked} onCheckedChange={handleCheckedChange} disabled={disabled} />
			<span className="min-w-0 space-y-1">
				<span className="block font-medium text-foreground">{name}</span>
				{addressText !== null ? <span className="block text-xs text-muted-foreground">{addressText}</span> : null}
			</span>
		</label>
	);
}

interface PendingInviteRowProps {
	readonly invite: TenantMemberInviteResponse;
	readonly locationLabel: string;
	readonly disabled: boolean;
	readonly onRevoke: (inviteId: string) => void;
}

function PendingInviteRow({ invite, locationLabel, disabled, onRevoke }: PendingInviteRowProps): React.JSX.Element {
	const handleRevoke = React.useCallback((): void => {
		onRevoke(invite.id);
	}, [invite.id, onRevoke]);

	return (
		<div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0 space-y-1">
				<p className="font-medium text-foreground">{invite.email}</p>
				<p className="text-sm text-muted-foreground">
					{TENANT_ROLE_LABELS[invite.intendedRole]} · {locationLabel}
				</p>
				<p className="text-xs text-muted-foreground">Invited by {invite.invitedByName}</p>
			</div>
			<Button type="button" variant="outline" size="sm" onClick={handleRevoke} disabled={disabled}>
				Revoke
			</Button>
		</div>
	);
}

/** Team route — roster, invites, and revocations need `merchant:manage_team` (enforced by the API on every call). */
export function TenantTeamPageView({ tenantSlug }: TenantTeamPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageTeam}
			loading={<MerchantTeamPageSkeleton />}
			fallback={
				<div className="space-y-8">
					<MerchantPageHeader title="Team & access" description="Invite colleagues and manage their store access." />
					<MerchantAccessDenied title="Team access required" description="Your role can't view or manage team members. Contact your store owner if you need access." />
				</div>
			}>
			<TenantTeamPageContent tenantSlug={tenantSlug} />
		</MerchantCapabilityGate>
	);
}

function TenantTeamPageContent({ tenantSlug }: TenantTeamPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const contextQuery = api.tenants.context.useQuery({ tenantSlug });
	// Each list's page is URL state (`?membersPage=` / `?invitesPage=`).
	const [membersUrlState, updateMembersUrlState] = useUrlState(TEAM_MEMBERS_URL_STATE);
	const [invitesUrlState, updateInvitesUrlState] = useUrlState(TEAM_INVITES_URL_STATE);
	const membersQuery = api.tenants.listMembers.useQuery(toTeamMembersQuery(tenantSlug, membersUrlState), { placeholderData: keepPreviousData });
	const invitesQuery = api.tenants.listMemberInvites.useQuery(toTeamInvitesQuery(tenantSlug, invitesUrlState), { placeholderData: keepPreviousData });
	const membersPager = useUrlListPager(membersUrlState, updateMembersUrlState, membersQuery.data?.meta);
	const invitesPager = useUrlListPager(invitesUrlState, updateInvitesUrlState, invitesQuery.data?.meta);

	const locations = contextQuery.data?.data !== undefined ? resolveActiveLocations(contextQuery.data.data) : [];

	const [values, setValues] = React.useState<InviteFormValues>(DEFAULT_INVITE_VALUES);
	const [error, setError] = React.useState<string | null>(null);

	const invalidateTeamQueries = React.useCallback(async (): Promise<void> => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: apiRouter.tenants.listMembers.scopeKey({ tenantSlug }) }),
			queryClient.invalidateQueries({ queryKey: apiRouter.tenants.listMemberInvites.scopeKey({ tenantSlug }) }),
		]);
	}, [tenantSlug, queryClient]);

	const inviteMutation = api.tenants.inviteMember.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Invitation sent" });
			setError(null);
			setValues(DEFAULT_INVITE_VALUES);
			await invalidateTeamQueries();
		},
		onError: (mutationError): void => {
			setError(resolveAuthErrorMessage(mutationError));
		},
	});

	const revokeMutation = api.tenants.revokeMemberInvite.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Invitation revoked" });
			await invalidateTeamQueries();
		},
		onError: (mutationError): void => {
			toastMessage.error({ title: resolveAuthErrorMessage(mutationError) });
		},
	});

	const handleEmailChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setValues((current) => ({ ...current, email: event.target.value }));
	}, []);

	const handleRoleChange = React.useCallback((value: string | null): void => {
		if (value === null) {
			return;
		}
		const parsedRole = TenantMemberInviteFieldsSchema.shape.role.safeParse(value);
		if (parsedRole.success) {
			setValues((current) => ({ ...current, role: parsedRole.data }));
		}
	}, []);

	const handleLocationScopeChange = React.useCallback((value: string | null): void => {
		if (value === null) {
			return;
		}
		const parsedScope = TenantMemberInviteFieldsSchema.shape.locationScopeType.safeParse(value);
		if (parsedScope.success) {
			setValues((current) => ({
				...current,
				locationScopeType: parsedScope.data,
				locationIds: parsedScope.data === "ALL_LOCATIONS" ? [] : current.locationIds,
			}));
		}
	}, []);

	const handleLocationToggle = React.useCallback((locationId: string, checked: boolean): void => {
		setValues((current) => {
			const nextLocationIds = checked ? [...current.locationIds, locationId] : current.locationIds.filter((id) => id !== locationId);
			return { ...current, locationIds: nextLocationIds };
		});
	}, []);

	const handleRevokeInvite = React.useCallback(
		(inviteId: string): void => {
			revokeMutation.mutate({ tenantSlug, inviteId });
		},
		[tenantSlug, revokeMutation],
	);

	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);

			const parsed = TenantMemberInviteSchema.safeParse(values);
			if (!parsed.success) {
				setError(parsed.error.issues[LIST_SLOT_INDEX.first]?.message ?? "Enter a valid email and role.");
				return;
			}

			inviteMutation.mutate({
				tenantSlug,
				email: parsed.data.email,
				role: parsed.data.role,
				locationScopeType: parsed.data.locationScopeType,
				locationIds: parsed.data.locationScopeType === "ALL_LOCATIONS" ? [] : parsed.data.locationIds,
			});
		},
		[inviteMutation, tenantSlug, values],
	);

	const members = membersQuery.data?.data ?? [];
	const pendingInvites = invitesQuery.data?.data ?? [];
	// Counted by the API over every page, never from the rows on screen.
	const memberCount = readPaginatedTotal(membersQuery.data?.meta, members.length);
	const inviteCount = readPaginatedTotal(invitesQuery.data?.meta, pendingInvites.length);

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="Team & access" description="Invite colleagues by email. They receive a link to accept and join with the role and store access you assign." />

			<Card className="gap-4 p-6">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-base font-semibold text-foreground">Current members</h2>
					{membersQuery.isLoading ? <Skeleton aria-hidden="true" className="h-5 w-8 rounded-full" /> : <Badge variant="outline">{String(memberCount)}</Badge>}
				</div>
				{membersQuery.isLoading ? (
					<SkeletonRegion labels={TEAM_MEMBERS_LOADING_LABELS}>
						<MerchantBorderedRowsSkeleton rows={TEAM_MEMBER_SKELETON_ROWS} lines={TEAM_MEMBER_LINES} trailing="badge" surface="card" />
					</SkeletonRegion>
				) : null}
				{members.length === 0 && !membersQuery.isLoading ? (
					membersPager.hasPrevious ? (
						<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
							<span>No members on this page.</span>
							<Button type="button" variant="outline" size="sm" onClick={membersPager.onFirstPage}>
								Go to the first page
							</Button>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">No members found.</p>
					)
				) : null}
				<div className="space-y-3">
					{members.map((member) => (
						<div key={member.id} className="rounded-lg border border-border bg-card p-4">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0 space-y-1">
									<p className="font-medium text-foreground">{member.fullName}</p>
									<p className="text-sm text-muted-foreground">{member.email}</p>
								</div>
								<Badge variant="secondary">{TENANT_ROLE_LABELS[member.role]}</Badge>
							</div>
							<p className="mt-2 text-sm text-muted-foreground">{formatLocationAccess(member, locations)}</p>
						</div>
					))}
				</div>
				{membersPager.isPaged ? (
					<ListPager
						page={membersPager.page}
						totalPages={membersPager.totalPages}
						hasPrevious={membersPager.hasPrevious}
						hasNext={membersPager.hasNext}
						onPrevious={membersPager.onPrevious}
						onNext={membersPager.onNext}
						disabled={membersQuery.isPlaceholderData}
						labels={MEMBER_PAGER_LABELS}
					/>
				) : null}
			</Card>

			<Card className="gap-4 p-6">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-base font-semibold text-foreground">Pending invitations</h2>
					{invitesQuery.isLoading ? <Skeleton aria-hidden="true" className="h-5 w-8 rounded-full" /> : <Badge variant="outline">{String(inviteCount)}</Badge>}
				</div>
				{invitesQuery.isLoading ? (
					<SkeletonRegion labels={TEAM_INVITES_LOADING_LABELS}>
						<MerchantBorderedRowsSkeleton rows={TEAM_INVITE_SKELETON_ROWS} lines={TEAM_INVITE_LINES} trailing="button" surface="card" />
					</SkeletonRegion>
				) : pendingInvites.length === 0 && invitesPager.hasPrevious ? (
					<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
						<span>No invitations on this page.</span>
						<Button type="button" variant="outline" size="sm" onClick={invitesPager.onFirstPage}>
							Go to the first page
						</Button>
					</div>
				) : pendingInvites.length === 0 ? (
					<p className="text-sm text-muted-foreground">No pending invitations.</p>
				) : (
					<div className="space-y-3">
						{pendingInvites.map((invite) => (
							<PendingInviteRow
								key={invite.id}
								invite={invite}
								locationLabel={formatInviteLocationAccess(invite, locations)}
								disabled={revokeMutation.isPending}
								onRevoke={handleRevokeInvite}
							/>
						))}
						{invitesPager.isPaged ? (
							<ListPager
								page={invitesPager.page}
								totalPages={invitesPager.totalPages}
								hasPrevious={invitesPager.hasPrevious}
								hasNext={invitesPager.hasNext}
								onPrevious={invitesPager.onPrevious}
								onNext={invitesPager.onNext}
								disabled={invitesQuery.isPlaceholderData}
								labels={INVITE_PAGER_LABELS}
							/>
						) : null}
					</div>
				)}
			</Card>

			<Card className="gap-6 p-6">
				<h2 className="text-base font-semibold text-foreground">Invite a team member</h2>
				<form className="space-y-6" onSubmit={handleSubmit}>
					<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
						<div className="space-y-2">
							<Label htmlFor="invite-email">Email address</Label>
							<Input
								id="invite-email"
								type="email"
								autoComplete="email"
								placeholder="alice@company.com"
								value={values.email}
								onChange={handleEmailChange}
								disabled={inviteMutation.isPending}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="invite-role">Role</Label>
							<Select items={INVITE_ROLES} value={values.role} onValueChange={handleRoleChange} disabled={inviteMutation.isPending}>
								<SelectTrigger id="invite-role">
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									{INVITE_ROLES.map((role) => (
										<SelectItem key={role.value} value={role.value}>
											{role.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-4 rounded-xl border border-border bg-background/60 p-4">
						<div className="space-y-2">
							<Label htmlFor="invite-location-scope">Location access</Label>
							<Select items={LOCATION_SCOPE_OPTIONS} value={values.locationScopeType} onValueChange={handleLocationScopeChange} disabled={inviteMutation.isPending}>
								<SelectTrigger id="invite-location-scope">
									<SelectValue placeholder="Select location scope" />
								</SelectTrigger>
								<SelectContent>
									{LOCATION_SCOPE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-sm text-muted-foreground">
								Members with all-locations access automatically gain access when new stores are added. Selected scope limits access to specific sites.
							</p>
						</div>

						{values.locationScopeType === "SELECTED" ? (
							<div className="space-y-3">
								<p className="text-sm font-medium text-foreground">Choose locations</p>
								{locations.length === 0 ? (
									<p className="text-sm text-muted-foreground">No active locations are available for this tenant yet.</p>
								) : (
									<div className="grid gap-3 sm:grid-cols-2">
										{locations.map((location) => (
											<TenantTeamLocationCheckbox
												key={location.id}
												locationId={location.id}
												name={location.name}
												addressText={location.addressText}
												checked={values.locationIds.includes(location.id)}
												disabled={inviteMutation.isPending}
												onToggle={handleLocationToggle}
											/>
										))}
									</div>
								)}
							</div>
						) : null}
					</div>

					{error !== null ? <p className="text-sm text-destructive">{error}</p> : null}

					<div className="flex flex-wrap items-center gap-3">
						<Button type="submit" disabled={inviteMutation.isPending}>
							{inviteMutation.isPending ? "Sending invite…" : "Send invitation"}
						</Button>
						<Link href={tenantRoutes(tenantSlug).dashboard} className="text-sm text-muted-foreground hover:text-foreground">
							Back to dashboard
						</Link>
					</div>
				</form>
			</Card>
		</div>
	);
}
