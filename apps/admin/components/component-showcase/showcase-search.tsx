"use client";

import { SearchIcon } from "lucide-react";
import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";
import { appRoute } from "@workspace/client/lib/navigation/app-route";
import * as React from "react";

import {
	Autocomplete,
	AutocompleteCollection,
	AutocompleteContent,
	AutocompleteEmpty,
	AutocompleteGroup,
	AutocompleteGroupLabel,
	AutocompleteInput,
	AutocompleteItem,
	AutocompleteList,
} from "@workspace/ui/components/autocomplete";
import { Kbd } from "@workspace/ui/components/kbd";
import { useFocusShortcut } from "@workspace/ui/hooks/use-focus-shortcut";
import { SHOWCASE_ROUTES } from "@/components/component-showcase/showcase-routes";
import { buildShowcaseSearchEntries, searchShowcase, type ShowcaseSearchEntry, type ShowcaseSearchKind } from "@/components/component-showcase/showcase-search-index";

/**
 * The key that focuses the search from anywhere on the page. Not `/`: the
 * sidebar's own search already answers to it across the app.
 */
const FOCUS_KEY = "s";
const PLACEHOLDER = "Search components and features…";
const GROUP_TITLES: Readonly<Record<ShowcaseSearchKind, string>> = { component: "Components", feature: "Features" };
const GROUP_ORDER: readonly ShowcaseSearchKind[] = ["component", "feature"];

/** One group of results, in the shape the autocomplete renders groups from. */
interface ResultGroup {
	readonly group: string;
	readonly items: readonly ShowcaseSearchEntry[];
}

type ValueChangeHandler = NonNullable<React.ComponentProps<typeof Autocomplete>["onValueChange"]>;

/** The results, split into components and features (empty groups left out). */
export function groupShowcaseResults(results: readonly ShowcaseSearchEntry[]): ResultGroup[] {
	return GROUP_ORDER.map((kind: ShowcaseSearchKind): ResultGroup => ({
		group: GROUP_TITLES[kind],
		items: results.filter((entry: ShowcaseSearchEntry): boolean => entry.kind === kind),
	})).filter((group: ResultGroup): boolean => group.items.length > 0);
}

function entryKey(entry: ShowcaseSearchEntry): string {
	return entry.key;
}

function renderEntry(entry: ShowcaseSearchEntry): React.JSX.Element {
	return (
		<AutocompleteItem key={entry.key} value={entry} className="flex items-center justify-between gap-3">
			<span className="truncate font-medium">{entry.title}</span>
			<span className="shrink-0 truncate text-xs text-muted-foreground">{entry.kind === "feature" ? entry.componentName : entry.familyTitle}</span>
		</AutocompleteItem>
	);
}

function renderGroup(group: ResultGroup): React.JSX.Element {
	return (
		<AutocompleteGroup key={group.group} items={group.items}>
			<AutocompleteGroupLabel className="sticky top-0 z-10 bg-popover py-2 text-xs font-medium text-muted-foreground">{group.group}</AutocompleteGroupLabel>
			<AutocompleteCollection>{renderEntry}</AutocompleteCollection>
		</AutocompleteGroup>
	);
}

/**
 * The showcase's search, pinned to the top of the page while it scrolls: it
 * finds a component or any one of its features ("soft wrap", "diff") and opens
 * it. `S` focuses it from anywhere on the page.
 */
export function ShowcaseSearch(): React.JSX.Element {
	const router = useProgressRouter();
	const inputRef = React.useRef<HTMLInputElement | null>(null);
	useFocusShortcut(inputRef, FOCUS_KEY);

	const entries = React.useMemo((): ShowcaseSearchEntry[] => buildShowcaseSearchEntries(SHOWCASE_ROUTES), []);
	const entriesByKey = React.useMemo(
		(): ReadonlyMap<string, ShowcaseSearchEntry> => new Map(entries.map((entry: ShowcaseSearchEntry): [string, ShowcaseSearchEntry] => [entry.key, entry])),
		[entries],
	);
	const [query, setQuery] = React.useState<string>("");
	const [isOpen, setIsOpen] = React.useState<boolean>(false);
	const results = React.useMemo((): ShowcaseSearchEntry[] => searchShowcase(entries, query), [entries, query]);
	const groups = React.useMemo((): ResultGroup[] => groupShowcaseResults(results), [results]);
	const hasQuery = query.trim().length > 0;

	const handleValueChange = React.useCallback<ValueChangeHandler>(
		(value, details): void => {
			const picked = details.reason === "item-press" ? entriesByKey.get(value) : undefined;
			if (picked === undefined) {
				setQuery(value);
				setIsOpen(value.trim().length > 0);
				return;
			}
			setQuery("");
			setIsOpen(false);
			inputRef.current?.blur();
			router.push(appRoute(picked.href));
		},
		[entriesByKey, router],
	);

	// A fixed height (--showcase-search-height, set by the showcase layout) so what sticks below it, the docs outline, can clear it.
	return (
		<div
			data-slot="showcase-search"
			className="sticky top-0 z-sticky -mx-4 -mt-6 mb-6 flex h-(--showcase-search-height) items-center border-b bg-background/95 px-4 backdrop-blur-sm sm:-mx-6 sm:-mt-8 sm:px-6">
			<search className="relative mx-auto flex w-full max-w-2xl items-center">
				<Autocomplete
					items={groups}
					value={query}
					onValueChange={handleValueChange}
					open={isOpen ? hasQuery : false}
					onOpenChange={setIsOpen}
					itemToStringValue={entryKey}
					filter={null}>
					<SearchIcon aria-hidden="true" className="pointer-events-none absolute start-3 z-10 size-4 text-muted-foreground" />
					<AutocompleteInput ref={inputRef} aria-label="Search components and features" aria-keyshortcuts="S" placeholder={PLACEHOLDER} className="ps-9 pe-10" />
					<Kbd aria-hidden="true" className="pointer-events-none absolute end-3">
						{FOCUS_KEY.toUpperCase()}
					</Kbd>
					<AutocompleteContent>
						{groups.length === 0 ? <AutocompleteEmpty>No component or feature matches.</AutocompleteEmpty> : <AutocompleteList>{renderGroup}</AutocompleteList>}
					</AutocompleteContent>
				</Autocomplete>
			</search>
		</div>
	);
}
