"use client";

import { Search } from "lucide-react";
import { useCallback } from "react";

import { useSearchContext } from "fumadocs-ui/contexts/search";

/**
 * Opens the search dialog from anywhere (hero, 404 page). The dialog is
 * registered on the `SearchProvider` via the `SearchDialog` prop, so this just
 * flips the shared context flag — no duplicate dialog markup.
 */ export function OpenSearchButton({ label = "Search the docs" }: { readonly label?: string }): React.JSX.Element {
	const { setOpenSearch } = useSearchContext();

	const openSearch = useCallback((): void => {
		setOpenSearch(true);
	}, [setOpenSearch]);

	return (
		<button
			type="button"
			onClick={openSearch}
			className="bg-fd-card text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium shadow-sm transition-colors">
			<Search className="size-4" />
			{label}
			<kbd className="border-fd-border bg-fd-muted text-fd-muted-foreground ms-2 hidden rounded-md border px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex">⌘K</kbd>
		</button>
	);
}
