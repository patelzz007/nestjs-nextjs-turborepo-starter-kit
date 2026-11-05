import { useDebouncedValue } from "@tanstack/react-pacer";
import { useRouter } from "@tanstack/react-router";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandList } from "@workspace/ui/components/command";
import { Kbd } from "@workspace/ui/components/kbd";
import { Spinner } from "@workspace/ui/components/spinner";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";

import { useSearchIndex } from "@/hooks/use-search-index";
import { queryTerms, searchIndex } from "@/lib/search";

import { SearchResult } from "./search-results";

/** Results shown in the dialog; the search page shows more. */
export const DIALOG_RESULT_LIMIT = 12;
/** How long typing must pause before the index is searched (Pacer). */
export const SEARCH_DEBOUNCE_MS = 120;

interface SearchContextValue {
	readonly openSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/** Opens the search dialog (the header button, the 404 page). */
export function useOpenSearch(): () => void {
	const context = useContext(SearchContext);
	if (context === null) {
		throw new Error("useOpenSearch must be used inside <SearchProvider>.");
	}
	return context.openSearch;
}

/** Whether a key press opens search: ⌘K / Ctrl K anywhere, or "/" outside a text field. */
export function isSearchShortcut(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "target">): boolean {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
		return true;
	}
	const target = event.target;
	const typing = target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select") !== null);
	return event.key === "/" && !typing;
}

export interface SearchProviderProps {
	readonly children: ReactNode;
}

/** The site-wide search dialog (`@workspace/ui` Command) and its keyboard shortcuts. */
export function SearchProvider({ children }: SearchProviderProps): ReactElement {
	const [open, setOpen] = useState(false);
	const openSearch = useCallback((): void => {
		setOpen(true);
	}, []);
	const value = useMemo((): SearchContextValue => ({ openSearch }), [openSearch]);

	useEffect((): (() => void) => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (isSearchShortcut(event)) {
				event.preventDefault();
				setOpen(true);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return (): void => {
			document.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	return (
		<SearchContext.Provider value={value}>
			{children}
			<SearchDialog open={open} onOpenChange={setOpen} />
		</SearchContext.Provider>
	);
}

interface SearchDialogProps {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}

function SearchDialog({ open, onOpenChange }: SearchDialogProps): ReactElement {
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [debouncedQuery] = useDebouncedValue(query, { wait: SEARCH_DEBOUNCE_MS });
	const index = useSearchIndex(open);
	const terms = queryTerms(debouncedQuery);
	const hits = index.data === undefined ? [] : searchIndex(index.data, debouncedQuery, DIALOG_RESULT_LIMIT);

	const go = useCallback(
		(href: string): void => {
			onOpenChange(false);
			setQuery("");
			void router.navigate({ href });
		},
		[onOpenChange, router],
	);
	const seeEveryResult = useCallback((): void => {
		go(`/search?q=${encodeURIComponent(debouncedQuery)}`);
	}, [debouncedQuery, go]);

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange} title="Search the docs" description="Search every guide, heading and blog post." className="sm:max-w-2xl">
			<Command shouldFilter={false} label="Search results">
				<CommandInput value={query} onValueChange={setQuery} placeholder="Search guides, headings and posts" aria-label="Search the docs" />
				<CommandList className="max-h-[min(60dvh,28rem)]">
					{index.isPending && open ? (
						<div role="status" className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
							<Spinner />
							Loading the search index…
						</div>
					) : null}
					{index.isError ? (
						<p role="alert" className="px-4 py-6 text-sm text-destructive">
							Search is unavailable: the index did not load. Reload the page to try again.
						</p>
					) : null}
					{index.isSuccess && terms.length > 0 && hits.length === 0 ? <CommandEmpty>No guide, heading or post matches “{debouncedQuery}”.</CommandEmpty> : null}
					{hits.length > 0 ? (
						<CommandGroup heading="Results">
							{hits.map((hit) => (
								<SearchResult key={hit.entry.href} hit={hit} terms={terms} onSelect={go} />
							))}
						</CommandGroup>
					) : null}
					{index.isSuccess && terms.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">Type to search every guide, heading and blog post.</p> : null}
				</CommandList>
				<footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<Kbd>↑</Kbd>
						<Kbd>↓</Kbd>
						to move, <Kbd>↵</Kbd> to open
					</span>
					<button
						type="button"
						className="rounded-sm font-medium text-(--docs-link) hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						onClick={seeEveryResult}>
						See every result
					</button>
				</footer>
			</Command>
		</CommandDialog>
	);
}
