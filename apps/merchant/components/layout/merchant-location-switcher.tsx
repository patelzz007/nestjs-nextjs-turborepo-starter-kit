"use client";

import { resolveLocationShortLabel } from "@/lib/org/location-display";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { useMerchantLocation, useTenantContextCommands, type TenantContextCommands } from "@/features/tenant-context/facade";
import { Button } from "@workspace/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@workspace/ui/components/select";
import { MapPin } from "lucide-react";
import * as React from "react";

const ALL_LOCATIONS_VALUE = "all";

interface AccessibleLocation {
	readonly id: string;
	readonly name: string;
	readonly code: string;
}

/** Applies a switcher choice (`undefined` = all locations) through the named tenant-context commands. */
function applyLocationChoice(commands: TenantContextCommands, locationId: string | undefined): void {
	if (locationId === undefined) {
		commands.selectAllLocations();
		return;
	}
	commands.selectLocation(locationId);
}

function resolveLocationSelection(
	locationId: string | undefined,
	accessibleLocations: readonly AccessibleLocation[],
	canSelectAllLocations: boolean,
): { readonly shortLabel: string; readonly fullLabel: string } {
	if (locationId === undefined) {
		const label = canSelectAllLocations ? "All locations" : "Select location";
		return { shortLabel: label, fullLabel: label };
	}

	const match = accessibleLocations.find((location) => location.id === locationId);

	if (match === undefined) {
		return { shortLabel: "Select location", fullLabel: "Select location" };
	}

	return {
		shortLabel: resolveLocationShortLabel(match),
		fullLabel: match.name,
	};
}

export function MerchantLocationSwitcher(): React.JSX.Element | null {
	const { locationId, activeLocation, accessibleLocations, canSelectAllLocations, isLoading } = useMerchantLocation();
	const commands = useTenantContextCommands();

	const handleValueChange = React.useCallback(
		(value: string | null): void => {
			if (value === null) {
				return;
			}
			applyLocationChoice(commands, value === ALL_LOCATIONS_VALUE ? undefined : value);
		},
		[commands],
	);

	const selectedLocation = React.useMemo(
		(): { readonly shortLabel: string; readonly fullLabel: string } => resolveLocationSelection(locationId, accessibleLocations, canSelectAllLocations),
		[accessibleLocations, canSelectAllLocations, locationId],
	);

	if (isLoading || accessibleLocations.length === 0) {
		return null;
	}

	const singleLocation = activeLocation ?? accessibleLocations[LIST_SLOT_INDEX.first];

	if (!canSelectAllLocations && accessibleLocations.length === 1 && singleLocation !== undefined) {
		const shortLabel = resolveLocationShortLabel(singleLocation);

		return (
			<div
				className="hidden max-w-[min(18rem,42vw)] items-center gap-2 overflow-hidden rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground md:flex"
				title={singleLocation.name}>
				<MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
				<span className="truncate">{shortLabel}</span>
			</div>
		);
	}

	// `locationId` is already validated against the accessible locations by the tenant-context selectors.
	const selectValue = locationId ?? ALL_LOCATIONS_VALUE;

	return (
		<div className="hidden max-w-[min(18rem,42vw)] md:block">
			<Select value={selectValue} onValueChange={handleValueChange}>
				<SelectTrigger
					className="h-9 w-full max-w-[min(18rem,42vw)] rounded-full border-border bg-card px-3"
					aria-label={`Active store location: ${selectedLocation.fullLabel}`}
					title={selectedLocation.fullLabel}>
					<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
						<MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
						<span className="truncate text-sm">{selectedLocation.shortLabel}</span>
					</div>
				</SelectTrigger>
				<SelectContent align="end" className="min-w-[min(18rem,80vw)]">
					{canSelectAllLocations ? <SelectItem value={ALL_LOCATIONS_VALUE}>All locations</SelectItem> : null}
					{accessibleLocations.map((location) => (
						<SelectItem key={location.id} value={location.id}>
							<div className="flex flex-col gap-0.5 py-0.5">
								<span className="font-medium">{resolveLocationShortLabel(location)}</span>
								<span className="text-xs text-muted-foreground">{location.name}</span>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

/**
 * The mobile button's next filter: each store in turn, then "all locations"
 * (only when the member may see org-wide rollups), then around again.
 * `undefined` = all locations.
 */
export function resolveNextCycledLocationId(
	accessibleLocations: readonly AccessibleLocation[],
	canSelectAllLocations: boolean,
	locationId: string | undefined,
): string | undefined {
	const currentIndex = accessibleLocations.findIndex((location) => location.id === locationId);

	if (!canSelectAllLocations) {
		const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % accessibleLocations.length;
		return accessibleLocations.at(nextIndex)?.id;
	}

	if (locationId === undefined) {
		return accessibleLocations.at(0)?.id;
	}

	if (currentIndex < accessibleLocations.length - 1) {
		return accessibleLocations.at(currentIndex + 1)?.id;
	}

	return undefined;
}

/** Compact location switcher for mobile topbars. */
export function MerchantLocationSwitcherMobile(): React.JSX.Element | null {
	const { locationId, accessibleLocations, canSelectAllLocations, isLoading } = useMerchantLocation();
	const commands = useTenantContextCommands();

	const handleCycleLocation = React.useCallback((): void => {
		applyLocationChoice(commands, resolveNextCycledLocationId(accessibleLocations, canSelectAllLocations, locationId));
	}, [accessibleLocations, canSelectAllLocations, commands, locationId]);

	if (isLoading || accessibleLocations.length === 0 || (!canSelectAllLocations && accessibleLocations.length === 1)) {
		return null;
	}

	const activeSelection = resolveLocationSelection(locationId, accessibleLocations, canSelectAllLocations);

	return (
		<Button
			type="button"
			variant="outline"
			size="icon"
			className="rounded-full md:hidden"
			onClick={handleCycleLocation}
			aria-label={`Switch store location (current: ${activeSelection.fullLabel})`}
			title={activeSelection.fullLabel}>
			<MapPin className="size-4" aria-hidden="true" />
		</Button>
	);
}
