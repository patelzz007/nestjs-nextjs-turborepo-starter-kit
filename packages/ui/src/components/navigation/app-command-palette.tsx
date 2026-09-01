"use client";

import { Command as CommandPrimitive } from "cmdk";
import { ArrowRight, ChevronDown, ChevronRight, Clock, FileText, Pin, Search, SearchX, X, Zap } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/form/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@workspace/ui/components/overlay/command";
import { highlightText } from "@workspace/ui/lib/highlight-text";
import { findSuggestion, matchesQuery, parseInput, scopeConfig } from "@workspace/ui/lib/palette-search";
import { getDefaultIconColor, getItemColor, getSectionBadgeColor } from "@workspace/ui/lib/palette-styles";
import type { PaletteRecentSearch, PaletteSearchableItem } from "@workspace/ui/lib/palette-types";
import { cn } from "@workspace/ui/lib/utils";

export interface AppCommandPaletteQuickAction {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly icon: React.ComponentType<{ readonly className?: string }>;
	readonly color: string;
	readonly shortcut?: string;
	readonly keywords?: readonly string[];
	readonly run: () => void;
}

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

const PALETTE_MARK_CLASS = "rounded-sm bg-amber-200/60 px-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";

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
				{/* Search Input */}
				<div className="px-4 pt-3 pb-2">
					<div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3.5 py-2.5 shadow-sm transition-all focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
						<Search className="size-4 shrink-0 text-muted-foreground/50 dark:text-muted-foreground/60" />

						{/* Scope badge */}
						{showScopeBadge ? (
							<Button
								type="button"
								variant="secondary"
								size="xs"
								onClick={handleClearScope}
								className={cn("gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase transition-all hover:brightness-110", scopeConfig[scope].color)}
								aria-label={`Clear ${scopeConfig[scope].label} scope filter`}>
								{scopeConfig[scope].label}
								<X className="size-3" />
							</Button>
						) : null}

						<CommandPrimitive.Input
							ref={inputRef}
							placeholder={placeholder}
							value={searchText}
							onValueChange={handleSearchChange}
							className="flex-1 bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground/50 dark:placeholder:text-muted-foreground/40"
						/>

						{/* Shortcut hint */}
						{!isSearching ? (
							<kbd className="hidden h-5 items-center gap-0.5 rounded-md bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground/50 sm:inline-flex dark:text-muted-foreground/60">
								⌘K
							</kbd>
						) : null}
					</div>
				</div>

				{/* Pinned section */}
				{showPinnedSection ? (
					<div className="animate-in pt-1 duration-300 fill-mode-both fade-in slide-in-from-bottom-1">
						<div className="flex items-center gap-1.5 px-4 py-1.5">
							<Pin className="size-3 text-muted-foreground/40" />
							<span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase dark:text-muted-foreground/60">Pinned</span>
						</div>
						<div className="flex flex-wrap gap-1.5 px-4 pb-1">
							{pinnedItems.map((pinned) => (
								<Button
									key={pinned.id}
									type="button"
									variant="outline"
									size="xs"
									data-url={pinned.url}
									onClick={handleSelectChip}
									className="gap-1.5 rounded-lg border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground/80 hover:border-border hover:bg-muted hover:text-foreground dark:text-muted-foreground/70">
									{renderIcon(pinned.icon, "size-3")}
									<span className="max-w-28 truncate">{pinned.title}</span>
								</Button>
							))}
						</div>
						{showRecentSection || showQuickSection || showNavSection ? (
							<div className="px-4 py-1">
								<div className="h-px bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent" />
							</div>
						) : null}
					</div>
				) : null}

				{/* Recent Searches */}
				{showRecentSection ? (
					<div className="animate-in pt-1 duration-300 fill-mode-both fade-in slide-in-from-bottom-1">
						<div className="flex items-center gap-1.5 px-4 py-1.5">
							<Clock className="size-3 text-muted-foreground/40" />
							<span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase dark:text-muted-foreground/60">Recent</span>
						</div>
						<div className="flex flex-wrap gap-1.5 px-4 pb-1">
							{filteredRecentSearches.map((recent) => (
								<Button
									key={recent.url}
									type="button"
									variant="outline"
									size="xs"
									data-url={recent.url}
									onClick={handleSelectChip}
									className="gap-1.5 rounded-lg border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground/80 hover:border-border hover:bg-muted hover:text-foreground dark:text-muted-foreground/70">
									{renderIcon(recent.icon, "size-3")}
									<span className="max-w-28 truncate">{recent.title}</span>
								</Button>
							))}
						</div>
						{showQuickSection || showNavSection ? (
							<div className="px-4 py-1">
								<div className="h-px bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent" />
							</div>
						) : null}
					</div>
				) : null}

				<CommandList className="max-h-none min-h-0 flex-1">
					{/* Quick Actions */}
					{showQuickSection ? (
						<CommandGroup>
							<div className="flex items-center gap-1.5 px-4 py-2">
								<Zap className="size-3 text-muted-foreground/40" />
								<span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase dark:text-muted-foreground/60">
									{scope === "commands" ? "Commands" : "Quick Actions"}
								</span>
							</div>

							{filteredQuickActions.map((action) => {
								const Icon = action.icon;
								const shortcut = action.shortcut;
								return (
									<CommandItem
										key={action.id}
										value={action.id}
										onSelect={handleSelectQuickAction}
										className="slide-in-from-bottom-0.5 flex animate-in items-center justify-between rounded-xl px-4 py-2.5 transition-all duration-75 fill-mode-both fade-in data-selected:bg-muted data-selected:text-foreground">
										<div className="flex min-w-0 flex-1 items-center gap-3">
											<div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", action.color)}>
												<Icon className="size-4" />
											</div>
											<div>
												<div className="text-sm leading-tight font-medium">
													{isSearching ? <>{highlightText(action.title, effectiveQuery, PALETTE_MARK_CLASS)}</> : action.title}
												</div>
												<div className="mt-0.5 text-xs text-muted-foreground/60">
													{isSearching ? <>{highlightText(action.description, effectiveQuery, PALETTE_MARK_CLASS)}</> : action.description}
												</div>
											</div>
										</div>
										{shortcut !== undefined ? (
											<kbd className="ml-3 inline-flex h-5 items-center rounded-md bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
												{shortcut}
											</kbd>
										) : null}
									</CommandItem>
								);
							})}
						</CommandGroup>
					) : null}

					{/* Separator between quick and nav */}
					{showQuickSection && showNavSection ? (
						<div className="px-4 py-1">
							<div className="h-px bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent" />
						</div>
					) : null}

					{/* Navigation Pages */}
					{showNavSection ? (
						<div className="pt-0.5 pb-1">
							{!isSearching && scope === "all" ? (
								<div className="flex items-center gap-1.5 px-4 py-2">
									<FileText className="size-3 text-muted-foreground/40" />
									<span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase dark:text-muted-foreground/60">Pages</span>
								</div>
							) : null}

							{Object.entries(filteredGroups).map((groupEntry) => {
								const section = groupEntry[0];
								const items = groupEntry[1];
								const isCollapsed = collapsedSections.has(section);

								return (
									<React.Fragment key={section}>
										<Button
											type="button"
											variant="nav"
											data-section={section}
											onClick={handleToggleSection}
											className="h-auto justify-between gap-2 px-4 py-2 text-left"
											aria-expanded={!isCollapsed}
											aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${section}`}>
											<span className="text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase">{section}</span>
											<ChevronDown className={cn("size-3 text-muted-foreground/50 transition-transform duration-150", isCollapsed && "-rotate-90")} />
										</Button>
										<div style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }} className="grid transition-all duration-200 ease-out">
											<div className="min-h-0 overflow-hidden">
												<CommandGroup className="mb-0.5">
													{items.map((item) => {
														const isPinned = pinnedUrls.includes(item.url);
														const itemIcon = renderIcon(item.icon, "size-4");
														return (
															<CommandItem
																key={item.id}
																value={item.url}
																onSelect={handleSelectItem}
																className="slide-in-from-bottom-0.5 flex animate-in items-center justify-between rounded-xl px-4 py-2.5 transition-all duration-75 fill-mode-both fade-in data-selected:bg-muted data-selected:text-foreground">
																<div className="flex min-w-0 flex-1 items-center gap-3">
																	{itemIcon !== null ? (
																		<div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors", getItemColor(item.title))}>
																			{itemIcon}
																		</div>
																	) : (
																		<div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", getDefaultIconColor())}>
																			<FileText className="size-4" />
																		</div>
																	)}

																	<div className="min-w-0 flex-1">
																		<div className="truncate text-sm leading-tight font-medium">
																			<>{highlightText(item.title, effectiveQuery, PALETTE_MARK_CLASS)}</>
																		</div>
																		{item.breadcrumb.length > 1 ? (
																			<div className="mt-0.5 flex items-center gap-1">
																				{item.breadcrumb.slice(0, -1).map((crumb, i) => (
																					<span key={`${crumb}-${String(i)}`} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40">
																						<span className="max-w-14 truncate">
																							<>{highlightText(crumb, effectiveQuery, PALETTE_MARK_CLASS)}</>
																						</span>
																						{i < item.breadcrumb.length - 2 ? <ChevronRight className="size-2.5 shrink-0" /> : null}
																					</span>
																				))}
																			</div>
																		) : null}
																	</div>
																</div>
																<div className="ml-2 flex shrink-0 items-center gap-1.5">
																	{/* Pin toggle */}
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon-xs"
																		data-url={item.url}
																		onClick={handleTogglePin}
																		className={cn("size-5 opacity-0 transition-all group-hover/command-item:opacity-100 data-selected:opacity-100", isPinned && "opacity-100")}
																		aria-label={isPinned ? `Unpin ${item.title}` : `Pin ${item.title}`}>
																		<Pin className={cn("size-3 transition-colors", isPinned ? "text-primary" : "text-muted-foreground/40")} />
																	</Button>

																	{/* Section badge */}
																	<span
																		className={cn(
																			"inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase",
																			getSectionBadgeColor(section),
																		)}>
																		{section}
																	</span>
																</div>
															</CommandItem>
														);
													})}
												</CommandGroup>
											</div>
										</div>
										{isCollapsed && items.length > 0 ? (
											<div className="px-4 py-2 text-[10px] text-muted-foreground/40 italic">
												<hr className="mb-2 h-px bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent" />
												{items.length} item{items.length !== 1 ? "s" : ""} hidden
											</div>
										) : null}
									</React.Fragment>
								);
							})}
						</div>
					) : null}

					{/* Search suggestion when no results */}
					{isSearching && !showQuickSection && !showNavSection && suggestion === null ? (
						<CommandEmpty>
							<div className="flex flex-col items-center gap-4 py-10">
								<div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60">
									<SearchX className="size-6 text-muted-foreground/40" />
								</div>
								<div className="max-w-60 text-center">
									<p className="text-sm font-medium text-foreground">No results found</p>
									<p className="mt-1 text-xs leading-relaxed text-muted-foreground/60">
										Try adjusting your search terms or{" "}
										<Button type="button" variant="link" size="sm" onClick={handleClearSearch} className="h-auto p-0 text-xs underline underline-offset-2 hover:no-underline">
											clear the filter
										</Button>{" "}
										to browse all pages
									</p>
								</div>
							</div>
						</CommandEmpty>
					) : null}

					{/* "Did you mean?" suggestion */}
					{isSearching && !showQuickSection && !showNavSection && suggestion !== null ? (
						<div className="flex flex-col items-center gap-3 py-10">
							<div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60">
								<SearchX className="size-6 text-muted-foreground/40" />
							</div>
							<div className="max-w-64 text-center">
								<p className="text-sm font-medium text-foreground">No results for &ldquo;{query}&rdquo;</p>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onClick={handleSelectSuggestion}
									className="mt-3 gap-2 rounded-xl bg-primary/10 px-4 py-2 text-primary hover:bg-primary/15">
									<ArrowRight className="size-4" />
									<span>Did you mean &ldquo;{suggestion.title}&rdquo;?</span>
								</Button>
							</div>
						</div>
					) : null}
				</CommandList>

				{/* Footer */}
				<div className="flex items-center justify-center gap-5 border-t border-border/40 bg-muted/30 px-4 py-2.5">
					<span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 dark:text-muted-foreground/60">
						<kbd className="inline-flex h-4 min-w-4.5 items-center justify-center rounded-md bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
							↑↓
						</kbd>
						<span>navigate</span>
					</span>
					<span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 dark:text-muted-foreground/60">
						<kbd className="inline-flex h-4 min-w-4.5 items-center justify-center rounded-md bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
							↵
						</kbd>
						<span>open</span>
					</span>
					<span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 dark:text-muted-foreground/60">
						<kbd className="inline-flex h-4 min-w-4.5 items-center justify-center rounded-md bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
							esc
						</kbd>
						<span>close</span>
					</span>
					<span className="mx-1 h-3 w-px bg-muted-foreground/10 dark:bg-muted-foreground/20" />
					<span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 dark:text-muted-foreground/50">
						<kbd className="inline-flex h-4 items-center rounded-md bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
							{">"}
						</kbd>
						<kbd className="inline-flex h-4 items-center rounded-md bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
							/
						</kbd>
						<kbd className="inline-flex h-4 items-center rounded-md bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
							#
						</kbd>
						<span>prefix</span>
					</span>
				</div>
			</Command>
		</CommandDialog>
	);
}
