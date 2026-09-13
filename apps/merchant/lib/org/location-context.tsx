"use client";

import { canSelectAllLocations, resolveAccessibleLocations, resolveInitialLocationId } from "@/lib/org/location-access";
import { clearOrganizationLocationCookie, readOrganizationLocationCookie, writeOrganizationLocationCookie } from "@/lib/org/location";
import { useOrganizationSlug } from "@/lib/org/use-organization-slug";
import { useAuth } from "@workspace/client/lib/auth";
import type { OrganizationLocationResponse } from "@workspace/shared";
import * as React from "react";

export interface MerchantLocationContextValue {
	readonly locationId: string | undefined;
	readonly activeLocation: OrganizationLocationResponse | undefined;
	readonly accessibleLocations: readonly OrganizationLocationResponse[];
	readonly canSelectAllLocations: boolean;
	readonly isLoading: boolean;
	readonly setLocationId: (locationId: string | undefined) => void;
}

const EMPTY_LOCATION_CONTEXT: MerchantLocationContextValue = {
	locationId: undefined,
	activeLocation: undefined,
	accessibleLocations: [],
	canSelectAllLocations: false,
	isLoading: false,
	setLocationId: (): void => undefined,
};

const MerchantLocationContext = React.createContext<MerchantLocationContextValue>(EMPTY_LOCATION_CONTEXT);

export function useMerchantLocation(): MerchantLocationContextValue {
	return React.useContext(MerchantLocationContext);
}

/** Optional location filter for org-scoped operational queries. */
export function useActiveLocationFilter(): { readonly locationId: string | undefined } {
	const { locationId } = useMerchantLocation();
	return React.useMemo(() => ({ locationId }), [locationId]);
}

interface MerchantLocationProviderInnerProps {
	readonly orgSlug: string;
	readonly children: React.ReactNode;
}

function MerchantLocationProviderInner({ orgSlug, children }: MerchantLocationProviderInnerProps): React.JSX.Element {
	const { api } = useAuth();
	const [manualLocationId, setManualLocationId] = React.useState<string | undefined>(undefined);
	const [hasManualSelection, setHasManualSelection] = React.useState<boolean>(false);

	const contextQuery = api.organizations.context.useQuery({ orgSlug });
	const context = contextQuery.data?.data;
	const accessibleLocations = React.useMemo((): readonly OrganizationLocationResponse[] => (context !== undefined ? resolveAccessibleLocations(context) : []), [context]);

	const defaultLocationId = React.useMemo((): string | undefined => resolveInitialLocationId(accessibleLocations, readOrganizationLocationCookie()), [accessibleLocations]);

	const locationId = hasManualSelection ? manualLocationId : defaultLocationId;

	const setLocationId = React.useCallback((nextLocationId: string | undefined): void => {
		setHasManualSelection(true);
		setManualLocationId(nextLocationId);
		if (nextLocationId === undefined) {
			clearOrganizationLocationCookie();
			return;
		}
		writeOrganizationLocationCookie(nextLocationId);
	}, []);

	const activeLocation = React.useMemo(
		(): OrganizationLocationResponse | undefined => accessibleLocations.find((location) => location.id === locationId),
		[accessibleLocations, locationId],
	);

	const contextValue = React.useMemo(
		(): MerchantLocationContextValue => ({
			locationId,
			activeLocation,
			accessibleLocations,
			canSelectAllLocations: canSelectAllLocations(accessibleLocations),
			isLoading: contextQuery.isLoading,
			setLocationId,
		}),
		[accessibleLocations, activeLocation, contextQuery.isLoading, locationId, setLocationId],
	);

	return <MerchantLocationContext.Provider value={contextValue}>{children}</MerchantLocationContext.Provider>;
}

export interface MerchantLocationProviderProps {
	readonly children: React.ReactNode;
}

export function MerchantLocationProvider({ children }: MerchantLocationProviderProps): React.JSX.Element {
	const orgSlug = useOrganizationSlug();

	if (orgSlug === undefined || orgSlug.length === 0) {
		return (
			<MerchantLocationContext.Provider
				value={{
					...EMPTY_LOCATION_CONTEXT,
					isLoading: true,
				}}>
				{children}
			</MerchantLocationContext.Provider>
		);
	}

	return (
		<MerchantLocationProviderInner key={orgSlug} orgSlug={orgSlug}>
			{children}
		</MerchantLocationProviderInner>
	);
}
