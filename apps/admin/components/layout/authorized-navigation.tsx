"use client";

import type { PaletteSearchableItem } from "@workspace/ui/lib/palette/types";
import * as React from "react";

const NO_SEARCHABLE_ITEMS: readonly PaletteSearchableItem[] = [];

function denyRoute(): boolean {
	return false;
}

interface AuthorizedNavigation {
	readonly searchableItems: readonly PaletteSearchableItem[];
	readonly canAccessRoute: (href: string) => boolean;
}

/** Outside the provider nothing is authorized (fail closed). */
const NO_NAVIGATION: AuthorizedNavigation = { searchableItems: NO_SEARCHABLE_ITEMS, canAccessRoute: denyRoute };

const AuthorizedNavigationContext = React.createContext<AuthorizedNavigation>(NO_NAVIGATION);

export interface AuthorizedNavigationProviderProps {
	/** Palette entries flattened from the capability + route-access filtered menu. */
	readonly searchableItems: readonly PaletteSearchableItem[];
	/** `href → may this session open it?` — the route guard's own rules. */
	readonly canAccessRoute: (href: string) => boolean;
	readonly children: React.ReactNode;
}

/**
 * Shares the authorized navigation computed once in `DashboardLayout` with
 * consumers outside the sidebar (command palette, topbar). Filtering happens
 * in the layout; consumers only read the result.
 */
export function AuthorizedNavigationProvider({ searchableItems, canAccessRoute, children }: AuthorizedNavigationProviderProps): React.JSX.Element {
	const value = React.useMemo((): AuthorizedNavigation => ({ searchableItems, canAccessRoute }), [searchableItems, canAccessRoute]);
	return <AuthorizedNavigationContext.Provider value={value}>{children}</AuthorizedNavigationContext.Provider>;
}

/** Authorized palette entries; empty (fail closed) outside the provider. */
export function useAuthorizedSearchableItems(): readonly PaletteSearchableItem[] {
	return React.useContext(AuthorizedNavigationContext).searchableItems;
}

/** Route-access predicate for hard-coded links; denies everything (fail closed) outside the provider. */
export function useCanAccessRoute(): (href: string) => boolean {
	return React.useContext(AuthorizedNavigationContext).canAccessRoute;
}
