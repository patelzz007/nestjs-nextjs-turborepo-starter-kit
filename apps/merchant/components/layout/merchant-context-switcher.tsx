"use client";

import { useActiveOrganizationLogo, useMerchantLocation, useTenantContextCommands, type TenantContextCommands } from "@/features/tenant-context/facade";
import { resolveLocationShortLabel } from "@/lib/org/location-display";
import { ORGANIZATION_ROLE_LABELS } from "@/lib/org/role-labels";
import { useOrganizationPath } from "@/lib/org/use-organization-path";
import { ORG_ROUTES } from "@/lib/routes";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import {
	PanelSidebarSwitcher,
	type PanelSidebarSwitcherAction,
	type PanelSidebarSwitcherGroup,
	type PanelSidebarSwitcherOption,
} from "@workspace/ui/components/panel-sidebar-switcher";
import { MapPinPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

/** The "All locations" choice's value (location ids are UUIDs, so it never collides). */
export const ALL_LOCATIONS_VALUE = "all";

const ALL_LOCATIONS_LABEL = "All locations";

interface SwitcherLocation {
	readonly id: string;
	readonly name: string;
	readonly code: string;
}

/** Applies a location choice (`ALL_LOCATIONS_VALUE` = the org-wide rollup) through the named tenant-context commands. */
export function applyLocationChoice(commands: Pick<TenantContextCommands, "selectAllLocations" | "selectLocation">, value: string): void {
	if (value === ALL_LOCATIONS_VALUE) {
		commands.selectAllLocations();
		return;
	}
	commands.selectLocation(value);
}

/** The Locations group's options: "All locations" first when the member may see org-wide rollups, then each store location. */
export function locationSwitcherOptions(locations: readonly SwitcherLocation[], canSelectAllLocations: boolean): readonly PanelSidebarSwitcherOption[] {
	return [
		...(canSelectAllLocations ? [{ value: ALL_LOCATIONS_VALUE, label: ALL_LOCATIONS_LABEL }] : []),
		...locations.map((location: SwitcherLocation): PanelSidebarSwitcherOption => ({
			value: location.id,
			label: resolveLocationShortLabel(location),
			description: location.name,
		})),
	];
}

/** The trigger's second line: the active location, "All locations", or — before any location is chosen or loaded — nothing. */
export function locationSwitcherSubtitle(activeLocation: SwitcherLocation | undefined, locationId: string | undefined, canSelectAllLocations: boolean): string | undefined {
	if (activeLocation !== undefined) {
		return resolveLocationShortLabel(activeLocation);
	}
	return locationId === undefined && canSelectAllLocations ? ALL_LOCATIONS_LABEL : undefined;
}

export interface MerchantContextSwitcherProps {
	readonly memberships: readonly OrganizationRewardMembershipResponse[];
	readonly organizationSlug: string | undefined;
	readonly onStoreChange: (slug: string) => void;
}

/**
 * The merchant sidebar's header (app shell 3): the active store and the store
 * location the portal is scoped to, opening a menu to change either — the
 * locations of this store (and "All locations" for members with org-wide
 * access), then the member's other stores. Choosing a location goes through
 * the tenant-context commands; choosing a store navigates to it. Members who
 * may see locations also get "Manage locations".
 */
export function MerchantContextSwitcher({ memberships, organizationSlug, onStoreChange }: MerchantContextSwitcherProps): React.JSX.Element {
	const { locationId, activeLocation, accessibleLocations, canSelectAllLocations, isLoading } = useMerchantLocation();
	const commands = useTenantContextCommands();
	const logo = useActiveOrganizationLogo();
	const { can } = useAuthorization();
	const router = useRouter();
	const locationsPath = useOrganizationPath(ORG_ROUTES.settings.locations);

	const activeMembership = memberships.find((membership: OrganizationRewardMembershipResponse): boolean => membership.organizationSlug === organizationSlug);
	const storeName = activeMembership?.displayName ?? "Select a store";

	const handleLocationChange = React.useCallback(
		(value: string): void => {
			applyLocationChoice(commands, value);
		},
		[commands],
	);

	const handleManageLocations = React.useCallback((): void => {
		router.push(locationsPath);
	}, [locationsPath, router]);

	const groups = React.useMemo((): readonly PanelSidebarSwitcherGroup[] => {
		const locationGroup: PanelSidebarSwitcherGroup = {
			id: "locations",
			label: "Locations",
			options: isLoading ? [] : locationSwitcherOptions(accessibleLocations, canSelectAllLocations),
			value: locationId ?? ALL_LOCATIONS_VALUE,
			onValueChange: handleLocationChange,
		};
		const storeGroup: PanelSidebarSwitcherGroup = {
			id: "stores",
			label: "Stores",
			// Listed only when there is another store to switch to.
			options:
				memberships.length > 1
					? memberships.map((membership: OrganizationRewardMembershipResponse): PanelSidebarSwitcherOption => ({
							value: membership.organizationSlug,
							label: membership.displayName,
							description: ORGANIZATION_ROLE_LABELS[membership.role],
							visual: <EntityAvatar name={membership.displayName} size="sm" className="size-7" />,
						}))
					: [],
			value: organizationSlug ?? "",
			onValueChange: onStoreChange,
		};
		return [locationGroup, storeGroup];
	}, [accessibleLocations, canSelectAllLocations, handleLocationChange, isLoading, locationId, memberships, onStoreChange, organizationSlug]);

	const actions = React.useMemo(
		(): readonly PanelSidebarSwitcherAction[] =>
			can(MERCHANT_CAPABILITY.viewLocations)
				? [{ id: "manage-locations", label: "Manage locations", icon: <MapPinPlus className="size-4" aria-hidden="true" />, onSelect: handleManageLocations }]
				: [],
		[can, handleManageLocations],
	);

	const subtitle =
		locationSwitcherSubtitle(activeLocation, locationId, canSelectAllLocations) ??
		(activeMembership === undefined ? undefined : ORGANIZATION_ROLE_LABELS[activeMembership.role]);

	return (
		<PanelSidebarSwitcher
			title={storeName}
			subtitle={subtitle}
			visual={<EntityAvatar name={storeName} src={logo?.url ?? null} sources={logo?.sources} size="sm" className="size-9" />}
			triggerLabel="Switch store or location"
			groups={groups}
			actions={actions}
		/>
	);
}
