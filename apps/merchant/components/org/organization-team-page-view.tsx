"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { organizationPath } from "@/lib/org/slug";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/errors";
import { useAuth } from "@workspace/client/lib/auth";
import { OrganizationMemberInviteSchema, type OrganizationLocationScopeType, type OrganizationMembershipRole } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import Link from "next/link";
import * as React from "react";
import { z } from "zod";

const INVITE_ROLES: readonly { readonly value: OrganizationMembershipRole; readonly label: string }[] = [
	{ value: "ADMIN", label: "Admin" },
	{ value: "MEMBER", label: "Member" },
	{ value: "CASHIER", label: "Cashier" },
	{ value: "POLICY_ADMIN", label: "Policy admin" },
];

const LOCATION_SCOPE_OPTIONS: readonly { readonly value: OrganizationLocationScopeType; readonly label: string }[] = [
	{ value: "ALL_LOCATIONS", label: "All locations" },
	{ value: "SELECTED", label: "Selected locations" },
];

const InviteFormSchema = OrganizationMemberInviteSchema.pick({ email: true, role: true, locationScopeType: true, locationIds: true });

type InviteFormValues = z.output<typeof InviteFormSchema>;

const DEFAULT_INVITE_VALUES: InviteFormValues = {
	email: "",
	role: "MEMBER",
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
};

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

export function OrganizationTeamPageView({ orgSlug }: OrganizationTeamPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const contextQuery = api.organizations.context.useQuery({ orgSlug });
	const locations = contextQuery.data?.data.locations ?? [];

	const [values, setValues] = React.useState<InviteFormValues>(DEFAULT_INVITE_VALUES);
	const [error, setError] = React.useState<string | null>(null);
	const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

	const inviteMutation = api.organizations.inviteMember.useMutation({
		onSuccess: (): void => {
			setSuccessMessage(`Invitation sent to ${values.email}. They must already have a Rewardly account.`);
			setError(null);
			setValues(DEFAULT_INVITE_VALUES);
		},
		onError: (mutationError): void => {
			setSuccessMessage(null);
			setError(resolveAuthErrorMessage(mutationError));
		},
	});

	const handleEmailChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setValues((current) => ({ ...current, email: event.target.value }));
	}, []);

	const handleRoleChange = React.useCallback((value: string | null): void => {
		if (value === null) {
			return;
		}
		const parsedRole = InviteFormSchema.shape.role.safeParse(value);
		if (parsedRole.success) {
			setValues((current) => ({ ...current, role: parsedRole.data }));
		}
	}, []);

	const handleLocationScopeChange = React.useCallback((value: string | null): void => {
		if (value === null) {
			return;
		}
		const parsedScope = InviteFormSchema.shape.locationScopeType.safeParse(value);
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

	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			setSuccessMessage(null);

			const parsed = InviteFormSchema.safeParse(values);
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Enter a valid email and role.");
				return;
			}

			if (parsed.data.locationScopeType === "SELECTED" && parsed.data.locationIds.length === 0) {
				setError("Select at least one location for this member.");
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

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="Team & access" description="Invite colleagues who already have Rewardly accounts. New users must sign up before you can add them." />

			<MerchantSurfacePanel className="space-y-6 p-6">
				<form className="space-y-6" onSubmit={handleSubmit}>
					<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
						<div className="space-y-2">
							<Label htmlFor="invite-email">Email address</Label>
							<Input
								id="invite-email"
								type="email"
								autoComplete="email"
								placeholder="colleague@company.com"
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
									<p className="text-sm text-muted-foreground">No locations are available for this organization yet.</p>
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
					{successMessage !== null ? <p className="text-sm text-success">{successMessage}</p> : null}

					<div className="flex flex-wrap items-center gap-3">
						<Button type="submit" disabled={inviteMutation.isPending}>
							{inviteMutation.isPending ? "Sending invite…" : "Invite member"}
						</Button>
						<Link href={organizationPath(orgSlug, "dashboard")} className="text-sm text-muted-foreground hover:text-foreground">
							Back to dashboard
						</Link>
					</div>
				</form>
			</MerchantSurfacePanel>
		</div>
	);
}
