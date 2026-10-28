"use client";

import { TENANT_ROLE_LABELS } from "@/contexts/tenancy/lib/tenant/role-labels";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	LIST_SLOT_INDEX,
	TenantMemberInviteFieldsSchema,
	TenantMemberInviteSchema,
	type LocationResponse,
	type LocationScopeType,
	type MembershipRole,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import type { z } from "zod";

/** Roles an invitation offers: a Manager or a Cashier (only an Owner makes an Owner, from a member's page). */
const INVITE_ROLES: readonly SelectOption<MembershipRole>[] = [
	{ value: "MANAGER", label: TENANT_ROLE_LABELS.MANAGER },
	{ value: "CASHIER", label: TENANT_ROLE_LABELS.CASHIER },
];

const LOCATION_SCOPE_OPTIONS: readonly SelectOption<LocationScopeType>[] = [
	{ value: "ALL_LOCATIONS", label: "All stores" },
	{ value: "SELECTED", label: "Selected stores" },
];

type InviteFormValues = z.output<typeof TenantMemberInviteFieldsSchema>;

const DEFAULT_INVITE_VALUES: InviteFormValues = { email: "", role: "CASHIER", locationScopeType: "ALL_LOCATIONS", locationIds: [] };

export interface InviteTeammateDialogProps {
	readonly tenantSlug: string;
	readonly locations: readonly LocationResponse[];
	readonly onClose: (open: boolean) => void;
	readonly onInvited: () => Promise<void>;
}

/**
 * Invite a teammate by email with a role and their stores. Mounted only while open, so each opening
 * starts from a fresh form. Validated with the API's own schema before sending.
 */
export function InviteTeammateDialog({ tenantSlug, locations, onClose, onInvited }: InviteTeammateDialogProps): React.JSX.Element {
	const { api } = useAuth();
	const [values, setValues] = React.useState<InviteFormValues>(DEFAULT_INVITE_VALUES);
	const [error, setError] = React.useState<string | null>(null);

	const inviteMutation = api.tenants.inviteMember.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Invitation sent" });
			await onInvited();
			onClose(false);
		},
		onError: (mutationError): void => {
			setError(resolveAuthErrorMessage(mutationError));
		},
	});

	const handleEmailChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setValues((current) => ({ ...current, email: event.target.value }));
	}, []);
	const handleRoleChange = React.useCallback((value: string | null): void => {
		const parsed = TenantMemberInviteFieldsSchema.shape.role.safeParse(value);
		if (parsed.success) {
			setValues((current) => ({ ...current, role: parsed.data }));
		}
	}, []);
	const handleScopeChange = React.useCallback((value: string | null): void => {
		const parsed = TenantMemberInviteFieldsSchema.shape.locationScopeType.safeParse(value);
		if (parsed.success) {
			setValues((current) => ({ ...current, locationScopeType: parsed.data, locationIds: parsed.data === "ALL_LOCATIONS" ? [] : current.locationIds }));
		}
	}, []);
	const handleLocationToggle = React.useCallback((locationId: string, checked: boolean): void => {
		setValues((current) => ({ ...current, locationIds: checked ? [...current.locationIds, locationId] : current.locationIds.filter((id) => id !== locationId) }));
	}, []);

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

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="sm:max-w-lg">
				<form className="space-y-5" onSubmit={handleSubmit} noValidate>
					<DialogHeader>
						<DialogTitle>Invite a teammate</DialogTitle>
						<DialogDescription>They get an email link to join with the role and stores you choose.</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="invite-email">Email address</Label>
						<Input id="invite-email" type="email" autoComplete="email" value={values.email} onChange={handleEmailChange} disabled={inviteMutation.isPending} />
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="invite-role">Role</Label>
							<Select items={INVITE_ROLES} value={values.role} onValueChange={handleRoleChange} disabled={inviteMutation.isPending}>
								<SelectTrigger id="invite-role">
									<SelectValue />
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
						<div className="space-y-2">
							<Label htmlFor="invite-location-scope">Stores</Label>
							<Select items={LOCATION_SCOPE_OPTIONS} value={values.locationScopeType} onValueChange={handleScopeChange} disabled={inviteMutation.isPending}>
								<SelectTrigger id="invite-location-scope">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{LOCATION_SCOPE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					{values.locationScopeType === "SELECTED" ? (
						locations.length === 0 ? (
							<p className="text-sm text-muted-foreground">No active stores yet.</p>
						) : (
							<fieldset className="space-y-2">
								<legend className="text-sm font-medium text-foreground">Choose stores</legend>
								<div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
									{locations.map((location) => (
										<StoreCheckbox
											key={location.id}
											locationId={location.id}
											name={location.name}
											checked={values.locationIds.includes(location.id)}
											disabled={inviteMutation.isPending}
											onToggle={handleLocationToggle}
										/>
									))}
								</div>
							</fieldset>
						)
					) : (
						<p className="text-sm text-muted-foreground">All-stores access includes stores you add later.</p>
					)}
					{error === null ? null : (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button type="submit" disabled={inviteMutation.isPending}>
							{inviteMutation.isPending ? "Sending invite…" : "Send invitation"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

interface StoreCheckboxProps {
	readonly locationId: string;
	readonly name: string;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly onToggle: (locationId: string, checked: boolean) => void;
}

function StoreCheckbox({ locationId, name, checked, disabled, onToggle }: StoreCheckboxProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(next: boolean): void => {
			onToggle(locationId, next);
		},
		[locationId, onToggle],
	);
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border p-3">
			<Checkbox id={`invite-store-${locationId}`} checked={checked} disabled={disabled} onCheckedChange={handleChange} />
			<label htmlFor={`invite-store-${locationId}`} className="text-sm text-foreground">
				{name}
			</label>
		</div>
	);
}
