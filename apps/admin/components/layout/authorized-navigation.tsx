"use client";

import type { PaletteSearchableItem } from "@workspace/ui/lib/palette/types";
import * as React from "react";

const NO_SEARCHABLE_ITEMS: readonly PaletteSearchableItem[] = [];

const AuthorizedSearchableItemsContext = React.createContext<readonly PaletteSearchableItem[]>(NO_SEARCHABLE_ITEMS);

export interface AuthorizedNavigationProviderProps {
	/** Palette entries flattened from the capability + feature-flag filtered menu. */
	readonly searchableItems: readonly PaletteSearchableItem[];
	readonly children: React.ReactNode;
}

/**
 * Shares the authorized navigation index computed once in `DashboardLayout`
 * with consumers outside the sidebar (command palette). Filtering happens in
 * the layout; consumers only read the result.
 */
export function AuthorizedNavigationProvider({ searchableItems, children }: AuthorizedNavigationProviderProps): React.JSX.Element {
	return <AuthorizedSearchableItemsContext.Provider value={searchableItems}>{children}</AuthorizedSearchableItemsContext.Provider>;
}

/** Authorized palette entries; empty (fail closed) outside the provider. */
export function useAuthorizedSearchableItems(): readonly PaletteSearchableItem[] {
	return React.useContext(AuthorizedSearchableItemsContext);
}
