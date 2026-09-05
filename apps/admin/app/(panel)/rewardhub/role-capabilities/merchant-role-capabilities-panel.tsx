"use client";

import { stubApiMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import {
	MerchantMemberRoleSchema,
	withMerchantCapabilityToggled,
	type CapabilityDefinition,
	type CapabilitySlug,
	type MerchantMemberRole,
	type MerchantRoleCapabilityGrant,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Label } from "@workspace/ui/components/form/label";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import * as React from "react";

const MERCHANT_ROLES: readonly MerchantMemberRole[] = MerchantMemberRoleSchema.options;

export interface MerchantRoleCapabilitiesPanelProps {
	readonly initialGrants?: readonly MerchantRoleCapabilityGrant[];
	readonly initialCatalog?: readonly CapabilityDefinition[];
}

interface MerchantRoleCapabilityCardProps {
	readonly role: MerchantMemberRole;
	readonly capabilities: readonly CapabilitySlug[];
	readonly catalog: readonly CapabilityDefinition[];
	readonly isPending: boolean;
	readonly onToggle: (role: MerchantMemberRole, capability: CapabilitySlug, enabled: boolean) => void;
	readonly onRestoreDefaults: (role: MerchantMemberRole) => void;
}

function MerchantRoleCapabilityCard({ role, capabilities, catalog, isPending, onToggle, onRestoreDefaults }: MerchantRoleCapabilityCardProps): React.JSX.Element {
	const handleRestoreClick = React.useCallback((): void => {
		onRestoreDefaults(role);
	}, [onRestoreDefaults, role]);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Shield className="size-4" aria-hidden="true" />
					{role}
				</CardTitle>
				<CardDescription>Capabilities stored in `merchant_role_capabilities` for this role.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{catalog.map((entry) => (
					<MerchantCapabilityToggleRow
						key={entry.slug}
						role={role}
						capability={entry.slug}
						checked={capabilities.includes(entry.slug)}
						disabled={isPending}
						label={entry.label}
						onToggle={onToggle}
					/>
				))}
				<div className="pt-2">
					<Button size="sm" variant="outline" disabled={isPending} onClick={handleRestoreClick}>
						Restore defaults
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

interface MerchantCapabilityToggleRowProps {
	readonly role: MerchantMemberRole;
	readonly capability: CapabilitySlug;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly label: string;
	readonly onToggle: (role: MerchantMemberRole, capability: CapabilitySlug, enabled: boolean) => void;
}

function MerchantCapabilityToggleRow({ role, capability, checked, disabled, label, onToggle }: MerchantCapabilityToggleRowProps): React.JSX.Element {
	const inputId = `${role}-${capability}`;

	const handleCheckedChange = React.useCallback(
		(value: boolean): void => {
			onToggle(role, capability, value);
		},
		[capability, onToggle, role],
	);

	return (
		<div className="flex items-start gap-3 rounded-md border px-3 py-3">
			<Checkbox id={inputId} checked={checked} disabled={disabled} onCheckedChange={handleCheckedChange} />
			<div className="space-y-1">
				<Label htmlFor={inputId} className="font-medium">
					{label}
				</Label>
				<p className="font-mono text-xs text-muted-foreground">{capability}</p>
			</div>
		</div>
	);
}

function readRoleCapabilities(grants: readonly MerchantRoleCapabilityGrant[], role: MerchantMemberRole): readonly CapabilitySlug[] {
	const grant = grants.find((entry) => entry.role === role);
	if (grant === undefined) {
		return [];
	}
	return grant.capabilities;
}

/** Admin editor — reads grants + catalog from the API and writes toggles back immediately. */
export default function MerchantRoleCapabilitiesPanel({ initialGrants, initialCatalog }: MerchantRoleCapabilitiesPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const catalogQuery = api.capabilities.catalog.useQuery(
		{ scope: "MERCHANT" },
		{
			initialData:
				initialCatalog !== undefined
					? {
							success: true as const,
							data: [...initialCatalog],
							meta: stubApiMeta(),
						}
					: undefined,
		},
	);

	const grantsQuery = api.rewardsAdmin.listMerchantRoleCapabilities.useQuery(
		{},
		{
			initialData:
				initialGrants !== undefined
					? {
							success: true as const,
							data: [...initialGrants],
							meta: stubApiMeta(),
						}
					: undefined,
		},
	);

	const catalog = React.useMemo((): readonly CapabilityDefinition[] => catalogQuery.data?.data ?? [], [catalogQuery.data?.data]);
	const catalogOrder = React.useMemo((): readonly CapabilitySlug[] => catalog.map((entry) => entry.slug), [catalog]);

	const serverGrants = React.useMemo((): readonly MerchantRoleCapabilityGrant[] => grantsQuery.data?.data ?? [], [grantsQuery.data?.data]);

	const syncMutation = api.rewardsAdmin.syncMerchantRoleCapabilities.useMutation({
		onSuccess: async (): Promise<void> => {
			await queryClient.invalidateQueries({ queryKey: ["rewards-admin", "merchant-role-capabilities"] });
		},
		onError: (error): void => {
			toastMessage.error({ title: "Update failed", description: error.message });
		},
	});

	const restoreMutation = api.rewardsAdmin.restoreMerchantRoleCapabilities.useMutation({
		onSuccess: async (): Promise<void> => {
			await queryClient.invalidateQueries({ queryKey: ["rewards-admin", "merchant-role-capabilities"] });
			toastMessage.success({ title: "Defaults restored", description: "Role capabilities reset from platform defaults." });
		},
		onError: (error): void => {
			toastMessage.error({ title: "Restore failed", description: error.message });
		},
	});

	const isPending = syncMutation.isPending || restoreMutation.isPending;

	const handleToggle = React.useCallback(
		(role: MerchantMemberRole, capability: CapabilitySlug, enabled: boolean): void => {
			const current = readRoleCapabilities(serverGrants, role);
			const next = withMerchantCapabilityToggled(catalogOrder, current, capability, enabled);
			void syncMutation.mutateAsync({ role, capabilities: next });
		},
		[catalogOrder, serverGrants, syncMutation],
	);

	const handleRestoreDefaults = React.useCallback(
		(role: MerchantMemberRole): void => {
			void restoreMutation.mutateAsync({ role });
		},
		[restoreMutation],
	);

	const isLoading = (catalogQuery.isLoading && catalog.length === 0) || (grantsQuery.isLoading && serverGrants.length === 0);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Merchant role capabilities</h1>
				<p className="text-sm text-muted-foreground">
					Toggle grants per role. Catalog and grants are loaded from the database — add slugs in `capability_definitions` without redeploying.
				</p>
			</header>

			{isLoading ? <p className="text-sm text-muted-foreground">Loading catalog and role grants…</p> : null}

			{catalog.length === 0 && !catalogQuery.isLoading ? (
				<p className="text-sm text-muted-foreground">No merchant capabilities in the catalog. Run migrations/seed or insert rows into `capability_definitions`.</p>
			) : null}

			<div className="grid gap-6 lg:grid-cols-2">
				{MERCHANT_ROLES.map((role) => (
					<MerchantRoleCapabilityCard
						key={role}
						role={role}
						catalog={catalog}
						capabilities={readRoleCapabilities(serverGrants, role)}
						isPending={isPending}
						onToggle={handleToggle}
						onRestoreDefaults={handleRestoreDefaults}
					/>
				))}
			</div>
		</div>
	);
}
