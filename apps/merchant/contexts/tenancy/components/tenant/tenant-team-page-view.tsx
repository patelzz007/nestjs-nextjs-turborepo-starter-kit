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
import { RoleCapabilityMatrix } from "@/contexts/tenancy/components/access/role-capability-matrix";
import { TeamRolesList } from "@/contexts/tenancy/components/access/team-roles-page-view";
import { InviteTeammateDialog } from "@/contexts/tenancy/components/tenant/invite-teammate-dialog";
import { resolveActiveLocations } from "@/contexts/tenancy/lib/tenant/location-access";
import { TENANT_ROLE_LABELS } from "@/contexts/tenancy/lib/tenant/role-labels";
import { TEAM_INVITES_URL_STATE, TEAM_MEMBERS_URL_STATE, TEAM_TAB_URL_STATE, TeamTabSchema, toTeamInvitesQuery, toTeamMembersQuery } from "@/contexts/tenancy/url-state/team";
import { tenantRoutes } from "@/lib/routes";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useUrlListPager } from "@workspace/client/lib/url-state/use-url-list-pager";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import {
	MERCHANT_CAPABILITY,
	PLATFORM_DISPLAY_REGION,
	type LocationResponse,
	type TenantMemberInviteResponse,
	type TenantMemberRosterResponse,
	type TenantRoleResponse,
} from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import { ListPager } from "@workspace/ui/components/list-pager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { toastMessage } from "@workspace/ui/components/toast";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { Lock, MoreHorizontal, UserPlus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** What the roster announces while the members load. */
export const TEAM_MEMBERS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading team members…" };
/** What the invitations panel announces while they load. */
export const TEAM_INVITES_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading invitations…" };
/** The two pagers' landmarks, named so a screen reader tells them apart. */
const MEMBER_PAGER_LABELS: UiKitLabelsOverride<"listPager"> = { ariaLabel: "Member pages" };
const INVITE_PAGER_LABELS: UiKitLabelsOverride<"listPager"> = { ariaLabel: "Invitation pages" };
const ROLE_CHANGE_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Change role", loading: "Changing…" };

const SECTION = { title: "Team & permissions", description: "Invite colleagues and control what each of them can do." };

/** "All stores", or the names of the member's stores. */
export function formatLocationAccess(
	member: Pick<TenantMemberRosterResponse, "locationScopeType" | "locationIds">,
	locations: readonly Pick<LocationResponse, "id" | "name">[],
): string {
	if (member.locationScopeType === "ALL_LOCATIONS") {
		return "All stores";
	}
	const labels = locations.filter((location) => member.locationIds.includes(location.id)).map((location) => location.name);
	return labels.length > 0 ? labels.join(", ") : "Selected stores";
}

export interface TenantTeamPageViewProps {
	readonly tenantSlug: string;
}

/** Team & permissions — the roster, invitations and roles; needs `merchant:manage_team` (the API decides every call). */
export function TenantTeamPageView({ tenantSlug }: TenantTeamPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageTeam}
			loading={<MerchantTeamPageSkeleton />}
			fallback={
				<div className="space-y-6">
					<SettingsSectionHeader {...SECTION} />
					<MerchantAccessDenied title="Team access required" description="Your role can't view or manage team members. Contact your store owner if you need access." />
				</div>
			}>
			<TenantTeamPageContent tenantSlug={tenantSlug} />
		</MerchantCapabilityGate>
	);
}

function TenantTeamPageContent({ tenantSlug }: TenantTeamPageViewProps): React.JSX.Element {
	const { api, user } = useAuth();
	const queryClient = useQueryClient();
	const contextQuery = api.tenants.context.useQuery({ tenantSlug });
	const rolesQuery = api.tenantAccess.roles.useQuery({ tenantSlug });
	const [tabState, updateTabState] = useUrlState(TEAM_TAB_URL_STATE);
	// Each list's page is URL state (`?membersPage=` / `?invitesPage=`).
	const [membersUrlState, updateMembersUrlState] = useUrlState(TEAM_MEMBERS_URL_STATE);
	const [invitesUrlState, updateInvitesUrlState] = useUrlState(TEAM_INVITES_URL_STATE);
	const membersQuery = api.tenants.listMembers.useQuery(toTeamMembersQuery(tenantSlug, membersUrlState), { placeholderData: keepPreviousData });
	const invitesQuery = api.tenants.listMemberInvites.useQuery(toTeamInvitesQuery(tenantSlug, invitesUrlState), { placeholderData: keepPreviousData });
	const membersPager = useUrlListPager(membersUrlState, updateMembersUrlState, membersQuery.data?.meta);
	const invitesPager = useUrlListPager(invitesUrlState, updateInvitesUrlState, invitesQuery.data?.meta);
	const [inviting, setInviting] = React.useState<boolean>(false);

	const context = contextQuery.data?.data;
	const locations = context === undefined ? [] : resolveActiveLocations(context);
	const timeZone = context?.tenant.timeZone ?? PLATFORM_DISPLAY_REGION.timeZone;
	const roles = rolesQuery.data?.data ?? [];
	const members = membersQuery.data?.data ?? [];
	const pendingInvites = invitesQuery.data?.data ?? [];
	// Counted by the API over every page, never from the rows on screen.
	const memberCount = readPaginatedTotal(membersQuery.data?.meta, members.length);
	const inviteCount = readPaginatedTotal(invitesQuery.data?.meta, pendingInvites.length);

	const invalidateTeamQueries = React.useCallback(async (): Promise<void> => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: apiRouter.tenants.listMembers.scopeKey({ tenantSlug }) }),
			queryClient.invalidateQueries({ queryKey: apiRouter.tenants.listMemberInvites.scopeKey({ tenantSlug }) }),
			queryClient.invalidateQueries({ queryKey: apiRouter.tenantAccess.roles.scopeKey({ tenantSlug }) }),
		]);
	}, [tenantSlug, queryClient]);

	const revokeMutation = api.tenants.revokeMemberInvite.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Invitation revoked" });
			await invalidateTeamQueries();
		},
		onError: (mutationError): void => {
			toastMessage.error({ title: resolveAuthErrorMessage(mutationError) });
		},
	});

	const handleTabChange = React.useCallback(
		(value: string | number | null): void => {
			const parsed = TeamTabSchema.safeParse(value);
			if (parsed.success) {
				updateTabState({ tab: parsed.data });
			}
		},
		[updateTabState],
	);
	const openInvite = React.useCallback((): void => {
		setInviting(true);
	}, []);
	const handleRevokeInvite = React.useCallback(
		(inviteId: string): void => {
			revokeMutation.mutate({ tenantSlug, inviteId });
		},
		[tenantSlug, revokeMutation],
	);
	const showRolesTab = React.useCallback((): void => {
		updateTabState({ tab: "roles" });
	}, [updateTabState]);

	return (
		<div className="space-y-6">
			<SettingsSectionHeader
				{...SECTION}
				action={
					<Button type="button" onClick={openInvite}>
						<UserPlus data-icon="inline-start" />
						Invite teammate
					</Button>
				}
			/>

			<Tabs value={tabState.tab} onValueChange={handleTabChange}>
				<TabsList variant="line" className="w-full justify-start gap-4 border-b border-border">
					<TabsTrigger value="members" className="gap-2">
						Members <TabCount count={memberCount} />
					</TabsTrigger>
					<TabsTrigger value="invites" className="gap-2">
						Pending invites <TabCount count={inviteCount} />
					</TabsTrigger>
					<TabsTrigger value="roles" className="gap-2">
						Roles <TabCount count={roles.length} />
					</TabsTrigger>
				</TabsList>

				<TabsContent value="members" className="mt-5 space-y-6">
					<div className="overflow-hidden rounded-xl border border-border bg-card">
						{membersQuery.isLoading ? (
							<SkeletonRegion labels={TEAM_MEMBERS_LOADING_LABELS} className="p-4">
								<MerchantBorderedRowsSkeleton rows={TEAM_MEMBER_SKELETON_ROWS} lines={TEAM_MEMBER_LINES} trailing="badge" surface="card" />
							</SkeletonRegion>
						) : members.length === 0 ? (
							<EmptyPage message="No members on this page." hasPrevious={membersPager.hasPrevious} onFirstPage={membersPager.onFirstPage} empty="No members found." />
						) : (
							<MembersTable tenantSlug={tenantSlug} members={members} roles={roles} locations={locations} timeZone={timeZone} currentUserId={user?.id} />
						)}
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
					<RoleCapabilityMatrix roles={roles} onCustomise={showRolesTab} />
				</TabsContent>

				<TabsContent value="invites" className="mt-5 space-y-4">
					<div className="overflow-hidden rounded-xl border border-border bg-card">
						{invitesQuery.isLoading ? (
							<SkeletonRegion labels={TEAM_INVITES_LOADING_LABELS} className="p-4">
								<MerchantBorderedRowsSkeleton rows={TEAM_INVITE_SKELETON_ROWS} lines={TEAM_INVITE_LINES} trailing="button" surface="card" />
							</SkeletonRegion>
						) : pendingInvites.length === 0 ? (
							<EmptyPage
								message="No invitations on this page."
								hasPrevious={invitesPager.hasPrevious}
								onFirstPage={invitesPager.onFirstPage}
								empty="No pending invitations."
							/>
						) : (
							<ul className="divide-y divide-border">
								{pendingInvites.map((invite) => (
									<PendingInviteRow
										key={invite.id}
										invite={invite}
										locationLabel={formatLocationAccess(invite, locations)}
										disabled={revokeMutation.isPending}
										onRevoke={handleRevokeInvite}
									/>
								))}
							</ul>
						)}
					</div>
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
				</TabsContent>

				<TabsContent value="roles" className="mt-5">
					<TeamRolesList tenantSlug={tenantSlug} />
				</TabsContent>
			</Tabs>

			{inviting ? <InviteTeammateDialog tenantSlug={tenantSlug} locations={locations} onClose={setInviting} onInvited={invalidateTeamQueries} /> : null}
		</div>
	);
}

function TabCount({ count }: { readonly count: number }): React.JSX.Element {
	return <span className="rounded-full bg-muted px-1.5 text-xs leading-5 font-medium text-muted-foreground tabular-nums">{String(count)}</span>;
}

interface EmptyPageProps {
	readonly message: string;
	readonly empty: string;
	readonly hasPrevious: boolean;
	readonly onFirstPage: () => void;
}

function EmptyPage({ message, empty, hasPrevious, onFirstPage }: EmptyPageProps): React.JSX.Element {
	return hasPrevious ? (
		<div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground">
			<span>{message}</span>
			<Button type="button" variant="outline" size="sm" onClick={onFirstPage}>
				Go to the first page
			</Button>
		</div>
	) : (
		<p className="p-6 text-sm text-muted-foreground">{empty}</p>
	);
}

// ── Members ────────────────────────────────────────────────────────────

interface MembersTableProps {
	readonly tenantSlug: string;
	readonly members: readonly TenantMemberRosterResponse[];
	readonly roles: readonly TenantRoleResponse[];
	readonly locations: readonly LocationResponse[];
	readonly timeZone: string;
	readonly currentUserId: string | undefined;
}

interface PendingRoleChange {
	readonly member: TenantMemberRosterResponse;
	readonly role: TenantRoleResponse;
}

function MembersTable({ tenantSlug, members, roles, locations, timeZone, currentUserId }: MembersTableProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [change, setChange] = React.useState<PendingRoleChange | null>(null);
	const changeMutation = api.tenantAccess.changeMemberRole.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Role changed" });
			setChange(null);
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.tenants.listMembers.scopeKey({ tenantSlug }) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.tenantAccess.roles.scopeKey({ tenantSlug }) }),
			]);
		},
	});

	const requestChange = React.useCallback(
		(member: TenantMemberRosterResponse, roleId: string): void => {
			const role = roles.find((candidate) => candidate.id === roleId);
			if (role !== undefined && role.id !== member.roleId) {
				changeMutation.reset();
				setChange({ member, role });
			}
		},
		[changeMutation, roles],
	);
	const handleDialogChange = React.useCallback((open: boolean): void => {
		if (!open) {
			setChange(null);
		}
	}, []);
	const confirm = React.useCallback((): void => {
		if (change !== null) {
			changeMutation.mutate({ tenantSlug, membershipId: change.member.id, roleId: change.role.id });
		}
	}, [change, changeMutation, tenantSlug]);

	return (
		<>
			<table className="w-full text-sm">
				<thead className="bg-muted/40 text-left text-xs text-muted-foreground">
					<tr>
						<th scope="col" className="px-4 py-3 font-medium">
							Member
						</th>
						<th scope="col" className="px-4 py-3 font-medium">
							Role
						</th>
						<th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">
							Stores
						</th>
						<th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
							Joined
						</th>
						<th scope="col" className="w-12 px-2 py-3">
							<span className="sr-only">Actions</span>
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{members.map((member) => (
						<MemberRow
							key={member.id}
							tenantSlug={tenantSlug}
							member={member}
							roles={roles}
							storesLabel={formatLocationAccess(member, locations)}
							timeZone={timeZone}
							isYou={member.userId === currentUserId}
							onChangeRole={requestChange}
						/>
					))}
				</tbody>
			</table>
			<AlertDialog open={change !== null} onOpenChange={handleDialogChange}>
				<AlertDialogContent align="start" actionOrder="cancel-first" labels={ROLE_CHANGE_LABELS} confirmLoading={changeMutation.isPending} onConfirm={confirm}>
					<AlertDialogTitle>
						Make {change?.member.fullName ?? ""} a {change?.role.name ?? ""}?
					</AlertDialogTitle>
					<AlertDialogDescription>Their permissions change at once. Extra permissions they were given stay until they end.</AlertDialogDescription>
					{changeMutation.error === null ? null : (
						<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{resolveAuthErrorMessage(changeMutation.error)}
						</p>
					)}
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

interface MemberRowProps {
	readonly tenantSlug: string;
	readonly member: TenantMemberRosterResponse;
	readonly roles: readonly TenantRoleResponse[];
	readonly storesLabel: string;
	readonly timeZone: string;
	readonly isYou: boolean;
	readonly onChangeRole: (member: TenantMemberRosterResponse, roleId: string) => void;
}

function MemberRow({ tenantSlug, member, roles, storesLabel, timeZone, isYou, onChangeRole }: MemberRowProps): React.JSX.Element {
	// Owners are made and unmade from a member's own page (only an Owner may), never from this list.
	const options: readonly SelectOption<string>[] = roles.filter((role) => role.templateKey !== "OWNER").map((role) => ({ value: role.id, label: role.name }));
	const isOwner = member.role === "OWNER";
	const roleName = roles.find((role) => role.id === member.roleId)?.name ?? TENANT_ROLE_LABELS[member.role];
	const accessHref = tenantRoutes(tenantSlug).settings.teamMember(member.id);
	const handleChange = React.useCallback(
		(roleId: string | null): void => {
			if (roleId !== null) {
				onChangeRole(member, roleId);
			}
		},
		[member, onChangeRole],
	);

	return (
		<tr className="align-middle">
			<td className="px-4 py-3">
				<div className="flex min-w-0 items-center gap-3">
					<EntityAvatar name={member.fullName} alt="" size="sm" />
					<div className="min-w-0">
						<p className="truncate font-medium text-foreground">
							{member.fullName}
							{isYou ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
						</p>
						<p className="truncate text-xs text-muted-foreground">{member.email}</p>
					</div>
				</div>
			</td>
			<td className="px-4 py-3">
				{isOwner || isYou ? (
					<span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm text-muted-foreground">
						{roleName}
						{isOwner ? <Lock aria-hidden="true" className="size-3.5" /> : null}
					</span>
				) : (
					<Select items={options} value={member.roleId} onValueChange={handleChange}>
						<SelectTrigger size="sm" aria-label={`Role of ${member.fullName}`} className="w-auto min-w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{options.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</td>
			<td className="hidden max-w-56 truncate px-4 py-3 text-muted-foreground md:table-cell">{storesLabel}</td>
			<td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{formatEpochMs(member.createdAt, "date", { locale: PLATFORM_DISPLAY_REGION.locale, timeZone })}</td>
			<td className="px-2 py-3 text-right">
				<DropdownMenu>
					<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for ${member.fullName}`} />}>
						<MoreHorizontal />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuItem render={<Link href={accessHref} />}>Role & extra permissions</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</td>
		</tr>
	);
}

// ── Invitations ────────────────────────────────────────────────────────

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
		<li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-center gap-3">
				<EntityAvatar name={invite.email} alt="" size="sm" />
				<div className="min-w-0 space-y-0.5">
					<p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
						<span className="truncate">{invite.email}</span>
						<Badge variant="warning-light">Invite pending</Badge>
					</p>
					<p className="text-sm text-muted-foreground">
						{TENANT_ROLE_LABELS[invite.intendedRole]} · {locationLabel} · invited by {invite.invitedByName}
					</p>
				</div>
			</div>
			<Button type="button" variant="outline" size="sm" onClick={handleRevoke} disabled={disabled}>
				Revoke
			</Button>
		</li>
	);
}
