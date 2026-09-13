"use client";

import * as React from "react";

import { Command, CommandDialog, CommandList } from "@workspace/ui/components/overlay/command";
import { findSuggestion, matchesQuery, parseInput } from "@workspace/ui/lib/palette/search";
import type { PaletteRecentSearch, PaletteSearchableItem } from "@workspace/ui/lib/palette/types";

import {
	AppCommandPaletteEmptyState,
	AppCommandPaletteFooter,
	AppCommandPaletteNavigationSection,
	AppCommandPalettePinnedSection,
	AppCommandPaletteQuickActionsSection,
	AppCommandPaletteRecentSection,
	AppCommandPaletteSearchInput,
	AppCommandPaletteSuggestion,
	type AppCommandPaletteQuickAction,
} from "./app-command-palette-parts";

export type { AppCommandPaletteQuickAction };

export interface AppCommandPaletteProps {
	readonly open?: boolean;
	readonly setOpen?: (open: boolean) => void;
	readonly title: string;
	readonly description: string;
	readonly placeholder?: string;
	readonly searchableItems: readonly PaletteSearchableItem[];
	readonly quickActions: readonly AppCommandPaletteQuickAction[];
	readonly recentSearches: readonly PaletteRecentSearch[];
	readonly pinnedUrls: readonly string[];
	readonly onAddRecent: (item: PaletteRecentSearch) => void;
	readonly onTogglePinned: (url: string) => void;
	readonly onNavigate: (url: string) => void;
	readonly renderIcon: (iconName: string | undefined, className: string) => React.ReactNode;
	readonly aliasMap?: Readonly<Record<string, readonly string[]>>;
}

export function AppCommandPalette({
	open: externalOpen,
	setOpen: externalSetOpen,
	title,
	description,
	placeholder = "Search pages, commands, settings…",
	searchableItems,
	quickActions,
	recentSearches,
	pinnedUrls,
	onAddRecent,
	onTogglePinned,
	onNavigate,
	renderIcon,
	aliasMap = {},
}: AppCommandPaletteProps): React.JSX.Element {
	const [internalOpen, setInternalOpen] = React.useState(false);
	const [searchText, setSearchText] = React.useState("");
	const [collapsedSections, setCollapsedSections] = React.useState<ReadonlySet<string>>(new Set());
	const inputRef = React.useRef<HTMLInputElement | null>(null);

	const open = externalOpen ?? internalOpen;
	const setOpen = externalSetOpen ?? setInternalOpen;

	/* ── Parse input ───────────────────────────────────────────── */

	const { scope, query } = parseInput(searchText);
	const showScopeBadge = scope !== "all";
	const isSearching = searchText.trim().length > 0;
	const effectiveQuery = isSearching ? query : "";

	/* ── Focus the input when opened ───────────────────────────── */

	React.useEffect(() => {
		if (open) {
			requestAnimationFrame(() => {
				inputRef.current?.focus();
			});
		}
	}, [open]);

	/* ── Input handlers ─────────────────────────────────────────── */

	const handleClearScope = React.useCallback((): void => {
		setSearchText((prev) => prev.replace(/^\s*[>/#]\s*/, ""));
	}, []);

	const handleClearSearch = React.useCallback((): void => {
		setSearchText("");
	}, []);

	const handleSearchChange = React.useCallback((value: string): void => {
		setSearchText(value);
	}, []);

	/* ── Group items by section ─────────────────────────────────── */

	const groupedItems = React.useMemo(() => {
		const groups: Record<string, PaletteSearchableItem[]> = {};
		for (const item of searchableItems) {
			const group = groups[item.section];
			if (group !== undefined) {
				group.push(item);
			} else {
				groups[item.section] = [item];
			}
		}
		return groups;
	}, [searchableItems]);

	const searchableItemByUrl = React.useMemo(() => {
		const map = new Map<string, PaletteSearchableItem>();
		for (const item of searchableItems) {
			map.set(item.url, item);
		}
		return map;
	}, [searchableItems]);

	/* ── Pinned navigation items ────────────────────────────────── */

	const pinnedItems = React.useMemo(() => {
		const items: PaletteSearchableItem[] = [];
		for (const url of pinnedUrls) {
			const found = searchableItemByUrl.get(url);
			if (found !== undefined) {
				items.push(found);
			}
		}
		return items;
	}, [pinnedUrls, searchableItemByUrl]);

	/* ── Toggle section collapse ────────────────────────────────── */

	const handleToggleSection = React.useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const section = event.currentTarget.dataset.section;
		if (section === undefined) {
			return;
		}
		setCollapsedSections((prev) => {
			const next = new Set(prev);
			if (next.has(section)) {
				next.delete(section);
			} else {
				next.add(section);
			}
			return next;
		});
	}, []);

	/* ── Quick actions (from props) ─────────────────────────────── */

	const quickActionById = React.useMemo(() => {
		const map = new Map<string, AppCommandPaletteQuickAction>();
		for (const action of quickActions) {
			map.set(action.id, action);
		}
		return map;
	}, [quickActions]);

	/* ── Handle item selection ──────────────────────────────────── */

	const navigateToUrl = React.useCallback(
		(url: string): void => {
			const item = searchableItemByUrl.get(url);
			if (item === undefined) {
				return;
			}
			onAddRecent({ title: item.title, url: item.url, section: item.section, icon: item.icon });
			setOpen(false);
			onNavigate(item.url);
		},
		[searchableItemByUrl, onAddRecent, setOpen, onNavigate],
	);

	const handleSelectItem = React.useCallback(
		(value: string): void => {
			navigateToUrl(value);
		},
		[navigateToUrl],
	);

	const handleSelectChip = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const url = event.currentTarget.dataset.url;
			if (url !== undefined) {
				navigateToUrl(url);
			}
		},
		[navigateToUrl],
	);

	const handleSelectQuickAction = React.useCallback(
		(value: string): void => {
			const action = quickActionById.get(value);
			if (action !== undefined) {
				action.run();
			}
		},
		[quickActionById],
	);

	const handleTogglePin = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			event.stopPropagation();
			const url = event.currentTarget.dataset.url;
			if (url !== undefined) {
				onTogglePinned(url);
			}
		},
		[onTogglePinned],
	);

	/* ── Filtering logic ────────────────────────────────────────── */

	const filteredQuickActions = React.useMemo((): readonly AppCommandPaletteQuickAction[] => {
		if (scope === "files" || scope === "settings") {
			return [];
		}
		if (scope === "commands" || !isSearching) {
			return quickActions;
		}
		const q = effectiveQuery.toLowerCase();
		return quickActions.filter(
			(action) => action.title.toLowerCase().includes(q) || action.description.toLowerCase().includes(q) || (action.keywords ?? []).some((kw) => kw.toLowerCase().includes(q)),
		);
	}, [quickActions, scope, isSearching, effectiveQuery]);

	const filteredGroups = React.useMemo(() => {
		const result: Record<string, PaletteSearchableItem[]> = {};
		if (scope === "commands") {
			return result;
		}

		for (const entry of Object.entries(groupedItems)) {
			const section = entry[0];
			const items = entry[1];
			let matched = items;

			if (scope === "settings") {
				const settingsKeywords: readonly string[] = ["settings", "security", "billing", "api keys", "sessions", "audit"];
				if (!settingsKeywords.some((keyword) => section.toLowerCase().includes(keyword) || items.some((item) => item.title.toLowerCase().includes(keyword)))) {
					matched = [];
				}
			}

			if (isSearching || scope !== "all") {
				const q = effectiveQuery.toLowerCase();
				matched = matched.filter((item) => matchesQuery(item.title, item.breadcrumb, q, aliasMap));
			}

			if (matched.length > 0) {
				result[section] = matched;
			}
		}
		return result;
	}, [groupedItems, scope, isSearching, effectiveQuery, aliasMap]);

	const filteredRecentSearches = React.useMemo((): readonly PaletteRecentSearch[] => {
		if (isSearching || scope !== "all") {
			return [];
		}
		return recentSearches;
	}, [recentSearches, isSearching, scope]);

	/* ── Compute whether to show sections ─────────────────────── */

	const showQuickSection = filteredQuickActions.length > 0;
	const showNavSection = Object.keys(filteredGroups).length > 0;
	const showRecentSection = filteredRecentSearches.length > 0;
	const showPinnedSection = pinnedItems.length > 0 && !isSearching && scope === "all";

	/* ── Find closest suggestion for no-match queries ──────────── */

	const suggestion = React.useMemo((): PaletteSearchableItem | null => {
		if (isSearching && !showQuickSection && !showNavSection) {
			return findSuggestion(effectiveQuery, searchableItems);
		}
		return null;
	}, [effectiveQuery, isSearching, showQuickSection, showNavSection, searchableItems]);

	const handleSelectSuggestion = React.useCallback((): void => {
		if (suggestion !== null) {
			navigateToUrl(suggestion.url);
		}
	}, [suggestion, navigateToUrl]);

	/* ── Render ────────────────────────────────────────────────── */

	return (
		<CommandDialog open={open} onOpenChange={setOpen} title={title} description={description} className="h-[65dvh] sm:max-w-2xl">
			<Command shouldFilter={false}>
				<AppCommandPaletteSearchInput
					inputRef={inputRef}
					placeholder={placeholder}
					searchText={searchText}
					showScopeBadge={showScopeBadge}
					scope={scope}
					isSearching={isSearching}
					onClearScope={handleClearScope}
					onSearchChange={handleSearchChange}
				/>

				{showPinnedSection ? (
					<AppCommandPalettePinnedSection
						pinnedItems={pinnedItems}
						showDivider={showRecentSection || showQuickSection || showNavSection}
						renderIcon={renderIcon}
						onSelectChip={handleSelectChip}
					/>
				) : null}

				{showRecentSection ? (
					<AppCommandPaletteRecentSection
						recentSearches={filteredRecentSearches}
						showDivider={showQuickSection || showNavSection}
						renderIcon={renderIcon}
						onSelectChip={handleSelectChip}
					/>
				) : null}

				<CommandList className="max-h-none min-h-0 flex-1">
					{showQuickSection ? (
						<AppCommandPaletteQuickActionsSection
							actions={filteredQuickActions}
							scope={scope}
							isSearching={isSearching}
							effectiveQuery={effectiveQuery}
							onSelectQuickAction={handleSelectQuickAction}
						/>
					) : null}

					{/* Separator between quick and nav */}
					{showQuickSection && showNavSection ? (
						<div className="px-4 py-1">
							<div className="h-px bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent" />
						</div>
					) : null}

					{showNavSection ? (
						<AppCommandPaletteNavigationSection
							filteredGroups={filteredGroups}
							collapsedSections={collapsedSections}
							isSearching={isSearching}
							scope={scope}
							effectiveQuery={effectiveQuery}
							pinnedUrls={pinnedUrls}
							renderIcon={renderIcon}
							onToggleSection={handleToggleSection}
							onSelectItem={handleSelectItem}
							onTogglePin={handleTogglePin}
						/>
					) : null}

					{isSearching && !showQuickSection && !showNavSection && suggestion === null ? <AppCommandPaletteEmptyState onClearSearch={handleClearSearch} /> : null}

					{isSearching && !showQuickSection && !showNavSection && suggestion !== null ? (
						<AppCommandPaletteSuggestion query={query} suggestion={suggestion} onSelectSuggestion={handleSelectSuggestion} />
					) : null}
				</CommandList>

				<AppCommandPaletteFooter />
			</Command>
		</CommandDialog>
	);
}
