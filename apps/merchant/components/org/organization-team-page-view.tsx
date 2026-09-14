"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { resolveActiveOrganizationLocations } from "@/lib/org/location-access";
import { organizationPath } from "@/lib/org/slug";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/errors";
import { useAuth } from "@workspace/client/lib/auth";
import {
	OrganizationMemberInviteFieldsSchema,
	OrganizationMemberInviteSchema,
	type OrganizationLocationResponse,
	type OrganizationLocationScopeType,
	type OrganizationMemberInviteResponse,
	type OrganizationMemberRosterResponse,
	type OrganizationMembershipRole,
} from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";
import { z } from "zod";

const INVITE_ROLES: readonly { readonly value: OrganizationMembershipRole; readonly label: string }[] = [
	{ value: "ADMIN", label: "Admin" },
	{ value: "MEMBER", label: "Member" },
	{ value: "CASHIER", label: "Cashier" },
	{ value: "POLICY_ADMIN", label: "Policy admin" },
];

const ROLE_LABELS: Readonly<Record<OrganizationMembershipRole, string>> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	POLICY_ADMIN: "Policy admin",
	CASHIER: "Cashier",
};

const LOCATION_SCOPE_OPTIONS: readonly { readonly value: OrganizationLocationScopeType; readonly label: string }[] = [
	{ value: "ALL_LOCATIONS", label: "All locations" },
	{ value: "SELECTED", label: "Selected locations" },
];

const TEAM_MANAGER_ROLES: readonly OrganizationMembershipRole[] = ["OWNER", "ADMIN"];

type InviteFormValues = z.output<typeof OrganizationMemberInviteFieldsSchema>;

const DEFAULT_INVITE_VALUES: InviteFormValues = {
	email: "",
	role: "MEMBER",
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
};

function formatLocationAccess(
	member: Pick<OrganizationMemberRosterResponse, "locationScopeType" | "locationIds">,
	locations: readonly OrganizationLocationResponse[],
): string {
	if (member.locationScopeType === "ALL_LOCATIONS") {
		return "All locations";
	}

	const labels = locations.filter((location) => member.locationIds.includes(location.id)).map((location) => location.name);
	return labels.length > 0 ? labels.join(", ") : "Selected locations";
}

function formatInviteLocationAccess(
	invite: Pick<OrganizationMemberInviteResponse, "locationScopeType" | "locationIds">,
	locations: readonly OrganizationLocationResponse[],
): string {
	return formatLocationAccess(invite, locations);
}

export interface OrganizationTeamPageViewProps {
	readonly orgSlug: string;
}

interface OrganizationTeamLocationCheckboxProps {
	readonly locationId: string;
	readonly name: string;
	readonly addressText: string | null;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly onToggle: (locationId: string, checked: boolean) => void;
}

function OrganizationTeamLocationCheckbox({ locationId, name, addressText, checked, disabled, onToggle }: OrganizationTeamLocationCheckboxProps): React.JSX.Element {
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
	readonly invite: OrganizationMemberInviteResponse;
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
					{ROLE_LABELS[invite.intendedRole]} · {locationLabel}
				</p>
				<p className="text-xs text-muted-foreground">Invited by {invite.invitedByName}</p>
			</div>
			<Button type="button" variant="outline" size="sm" onClick={handleRevoke} disabled={disabled}>
				Revoke
			</Button>
		</div>
	);
}

export function OrganizationTeamPageView({ orgSlug }: OrganizationTeamPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const contextQuery = api.organizations.context.useQuery({ orgSlug });
	const membersQuery = api.organizations.listMembers.useQuery({ orgSlug });
	const invitesQuery = api.organizations.listMemberInvites.useQuery({ orgSlug });

	const locations = contextQuery.data?.data !== undefined ? resolveActiveOrganizationLocations(contextQuery.data.data) : [];
	const canManageTeam = contextQuery.data?.data !== undefined && TEAM_MANAGER_ROLES.includes(contextQuery.data.data.membership.role);

	const [values, setValues] = React.useState<InviteFormValues>(DEFAULT_INVITE_VALUES);
	const [error, setError] = React.useState<string | null>(null);

	const invalidateTeamQueries = React.useCallback(async (): Promise<void> => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["organization", orgSlug, "members"] }),
			queryClient.invalidateQueries({ queryKey: ["organization", orgSlug, "members", "invites"] }),
		]);
	}, [orgSlug, queryClient]);

	const inviteMutation = api.organizations.inviteMember.useMutation({
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

	const revokeMutation = api.organizations.revokeMemberInvite.useMutation({
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
		const parsedRole = OrganizationMemberInviteFieldsSchema.shape.role.safeParse(value);
		if (parsedRole.success) {
			setValues((current) => ({ ...current, role: parsedRole.data }));
		}
	}, []);

	const handleLocationScopeChange = React.useCallback((value: string | null): void => {
		if (value === null) {
			return;
		}
		const parsedScope = OrganizationMemberInviteFieldsSchema.shape.locationScopeType.safeParse(value);
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
			revokeMutation.mutate({ orgSlug, inviteId });
		},
		[orgSlug, revokeMutation],
	);

	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);

			const parsed = OrganizationMemberInviteSchema.safeParse(values);
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Enter a valid email and role.");
				return;
			}

			inviteMutation.mutate({
				orgSlug,
				email: parsed.data.email,
				role: parsed.data.role,
				locationScopeType: parsed.data.locationScopeType,
				locationIds: parsed.data.locationScopeType === "ALL_LOCATIONS" ? [] : parsed.data.locationIds,
			});
		},
		[inviteMutation, orgSlug, values],
	);

	const members = membersQuery.data?.data ?? [];
	const pendingInvites = invitesQuery.data?.data ?? [];

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="Team & access" description="Invite colleagues by email. They receive a link to accept and join with the role and store access you assign." />

			<MerchantSurfacePanel className="space-y-4 p-6">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-base font-semibold text-foreground">Current members</h2>
					<Badge variant="outline">{String(members.length)}</Badge>
				</div>
				{membersQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading team…</p> : null}
				{members.length === 0 && !membersQuery.isLoading ? <p className="text-sm text-muted-foreground">No members found.</p> : null}
				<div className="space-y-3">
					{members.map((member) => (
						<div key={member.id} className="rounded-lg border border-border bg-card p-4">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0 space-y-1">
									<p className="font-medium text-foreground">{member.fullName}</p>
									<p className="text-sm text-muted-foreground">{member.email}</p>
								</div>
								<Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
							</div>
							<p className="mt-2 text-sm text-muted-foreground">{formatLocationAccess(member, locations)}</p>
						</div>
					))}
				</div>
			</MerchantSurfacePanel>

			{canManageTeam ? (
				<MerchantSurfacePanel className="space-y-4 p-6">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-base font-semibold text-foreground">Pending invitations</h2>
						<Badge variant="outline">{String(pendingInvites.length)}</Badge>
					</div>
					{invitesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading invitations…</p> : null}
					{pendingInvites.length === 0 && !invitesQuery.isLoading ? (
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
						</div>
					)}
				</MerchantSurfacePanel>
			) : null}

			{canManageTeam ? (
				<MerchantSurfacePanel className="space-y-6 p-6">
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
								<Select value={values.role} onValueChange={handleRoleChange} disabled={inviteMutation.isPending}>
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
								<Select value={values.locationScopeType} onValueChange={handleLocationScopeChange} disabled={inviteMutation.isPending}>
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
										<p className="text-sm text-muted-foreground">No active locations are available for this organization yet.</p>
									) : (
										<div className="grid gap-3 sm:grid-cols-2">
											{locations.map((location) => (
												<OrganizationTeamLocationCheckbox
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
							<Link href={organizationPath(orgSlug, "dashboard")} className="text-sm text-muted-foreground hover:text-foreground">
								Back to dashboard
							</Link>
						</div>
					</form>
				</MerchantSurfacePanel>
			) : (
				<MerchantSurfacePanel className="p-6">
					<p className="text-sm text-muted-foreground">Only organization owners and admins can invite or manage team members.</p>
				</MerchantSurfacePanel>
			)}
		</div>
	);
}
