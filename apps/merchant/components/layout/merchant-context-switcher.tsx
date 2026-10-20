"use client";

import {
	useActiveMembership,
	useActiveTenantLogo,
	useActiveTenantName,
	useMerchantLocation,
	useTenantContextCommands,
	type TenantContextCommands,
} from "@/features/tenant-context/facade";
import { resolveLocationShortLabel } from "@/contexts/tenancy/lib/org/location-display";
import { TENANT_ROLE_LABELS } from "@/contexts/tenancy/lib/org/role-labels";
import { useTenantPath } from "@/contexts/tenancy/lib/org/use-tenant-path";
import { TENANT_ROUTES } from "@/lib/routes";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import type { MembershipRole, TenantRewardMembershipResponse } from "@workspace/shared";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import { IconTile } from "@workspace/ui/components/icon-tile";
import {
	PanelSidebarSwitcher,
	type PanelSidebarSwitcherAction,
	type PanelSidebarSwitcherGroup,
	type PanelSidebarSwitcherOption,
} from "@workspace/ui/components/panel-sidebar-switcher";
import { Layers, List, MapPin, MapPinPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

/** The "All locations" choice's value (location ids are UUIDs, so it never collides). */
export const ALL_LOCATIONS_VALUE = "all";

const ALL_LOCATIONS_LABEL = "All locations";

/** Each location's mark in the switcher: a pin in the kit's "places" tone (blue). Decorative — the label names it. */
const LOCATION_VISUAL: React.ReactNode = (
	<IconTile tone="blue" size="sm">
		<MapPin aria-hidden="true" />
	</IconTile>
);

/** The org-wide rollup's mark: stacked layers in the brand tone, set apart from the single locations. */
const ALL_LOCATIONS_VISUAL: React.ReactNode = (
	<IconTile tone="brand" size="sm">
		<Layers aria-hidden="true" />
	</IconTile>
);

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

/**
 * A location's second line in the switcher: its full name, but only when that says more than the label —
 * "Brew & Bean KL — Bukit Bintang" under "Bukit Bintang" only repeats the store, which the trigger already names.
 */
export function locationSwitcherDescription(location: SwitcherLocation): string | undefined {
	return location.name.endsWith(resolveLocationShortLabel(location)) ? undefined : location.name;
}

/** The Locations group's options: "All locations" first when the member may see org-wide rollups, then each store location. */
export function locationSwitcherOptions(locations: readonly SwitcherLocation[], canSelectAllLocations: boolean): readonly PanelSidebarSwitcherOption[] {
	return [
		...(canSelectAllLocations ? [{ value: ALL_LOCATIONS_VALUE, label: ALL_LOCATIONS_LABEL, visual: ALL_LOCATIONS_VISUAL }] : []),
		...locations.map((location: SwitcherLocation): PanelSidebarSwitcherOption => ({
			value: location.id,
			label: resolveLocationShortLabel(location),
			description: locationSwitcherDescription(location),
			visual: LOCATION_VISUAL,
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
	/** The first page of the member's stores. */
	readonly memberships: readonly TenantRewardMembershipResponse[];
	/** Whether the member has more stores than that page: the menu then offers "All stores" (the stores page). */
	readonly hasMoreStores: boolean;
	readonly tenantSlug: string | undefined;
	readonly onStoreChange: (slug: string) => void;
}

/** One store the switcher offers. */
export interface SwitcherStore {
	readonly slug: string;
	readonly displayName: string;
	readonly role: MembershipRole;
}

/**
 * The stores the switcher lists: the first page of memberships, with the ACTIVE store first when that
 * page does not hold it (a store opened from "All stores" or a link), so the selected value always has
 * its option.
 */
export function storeSwitcherStores(memberships: readonly TenantRewardMembershipResponse[], active: SwitcherStore | undefined): readonly SwitcherStore[] {
	const listed: readonly SwitcherStore[] = memberships.map((membership): SwitcherStore => ({
		slug: membership.tenantSlug,
		displayName: membership.displayName,
		role: membership.role,
	}));
	return active === undefined || listed.some((store) => store.slug === active.slug) ? listed : [active, ...listed];
}

/**
 * The merchant sidebar's header (app shell 3): the active store and the store
 * location the portal is scoped to, opening a menu to change either — the
 * locations of this store (and "All locations" for members with org-wide
 * access), then the member's stores (the first page; "All stores" opens the
 * rest). Choosing a location goes through the tenant-context commands;
 * choosing a store navigates to it. Members who may see locations also get
 * "Manage locations".
 */
export function MerchantContextSwitcher({ memberships, hasMoreStores, tenantSlug, onStoreChange }: MerchantContextSwitcherProps): React.JSX.Element {
	const { locationId, activeLocation, accessibleLocations, canSelectAllLocations, isLoading } = useMerchantLocation();
	const commands = useTenantContextCommands();
	const logo = useActiveTenantLogo();
	const { can } = useAuthorization();
	const router = useRouter();
	const locationsPath = useTenantPath(TENANT_ROUTES.settings.locations);
	const storesPath = useTenantPath(TENANT_ROUTES.stores);
	// The active store and the member's role in it come from the tenant context, not from the list page.
	const { membership: activeMembership } = useActiveMembership();
	const storeName = useActiveTenantName() ?? "Select a store";

	const handleLocationChange = React.useCallback(
		(value: string): void => {
			applyLocationChoice(commands, value);
		},
		[commands],
	);

	const handleManageLocations = React.useCallback((): void => {
		router.push(locationsPath);
	}, [locationsPath, router]);

	const handleAllStores = React.useCallback((): void => {
		router.push(storesPath);
	}, [router, storesPath]);

	const activeStore = React.useMemo(
		(): SwitcherStore | undefined =>
			tenantSlug === undefined || activeMembership === undefined ? undefined : { slug: tenantSlug, displayName: storeName, role: activeMembership.role },
		[activeMembership, tenantSlug, storeName],
	);

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
				memberships.length > 1 || hasMoreStores
					? storeSwitcherStores(memberships, activeStore).map((store: SwitcherStore): PanelSidebarSwitcherOption => ({
							value: store.slug,
							label: store.displayName,
							description: TENANT_ROLE_LABELS[store.role],
							visual: <EntityAvatar name={store.displayName} size="sm" className="size-8" />,
						}))
					: [],
			value: tenantSlug ?? "",
			onValueChange: onStoreChange,
		};
		return [locationGroup, storeGroup];
	}, [accessibleLocations, activeStore, canSelectAllLocations, handleLocationChange, hasMoreStores, isLoading, locationId, memberships, onStoreChange, tenantSlug]);

	const actions = React.useMemo(
		(): readonly PanelSidebarSwitcherAction[] => [
			...(hasMoreStores ? [{ id: "all-stores", label: "All stores", icon: <List className="size-4" aria-hidden="true" />, onSelect: handleAllStores }] : []),
			...(can(MERCHANT_CAPABILITY.viewLocations)
				? [{ id: "manage-locations", label: "Manage locations", icon: <MapPinPlus className="size-4" aria-hidden="true" />, onSelect: handleManageLocations }]
				: []),
		],
		[can, handleAllStores, handleManageLocations, hasMoreStores],
	);

	const subtitle =
		locationSwitcherSubtitle(activeLocation, locationId, canSelectAllLocations) ?? (activeMembership === undefined ? undefined : TENANT_ROLE_LABELS[activeMembership.role]);

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
