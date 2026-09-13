"use client";

import { Command as CommandPrimitive } from "cmdk";
import { ArrowRight, ChevronDown, ChevronRight, Clock, FileText, Pin, Search, SearchX, X, Zap } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/form/button";
import { CommandEmpty, CommandGroup, CommandItem } from "@workspace/ui/components/overlay/command";
import { highlightText } from "@workspace/ui/lib/core/highlight-text";
import { scopeConfig } from "@workspace/ui/lib/palette/search";
import { getDefaultIconColor, getItemColor, getSectionBadgeColor } from "@workspace/ui/lib/palette/styles";
import type { PaletteRecentSearch, PaletteSearchableItem } from "@workspace/ui/lib/palette/types";
import { cn } from "@workspace/ui/lib/core/utils";

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

export const PALETTE_MARK_CLASS = "rounded-sm bg-amber-200/60 px-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";

// ── Search Input ────────────────────────────────────────────────────────────

export interface AppCommandPaletteSearchInputProps {
	readonly inputRef: React.RefObject<HTMLInputElement | null>;
	readonly placeholder: string;
	readonly searchText: string;
	readonly showScopeBadge: boolean;
	readonly scope: keyof typeof scopeConfig;
	readonly isSearching: boolean;
	readonly onClearScope: () => void;
	readonly onSearchChange: (value: string) => void;
}

export function AppCommandPaletteSearchInput({
	inputRef,
	placeholder,
	searchText,
	showScopeBadge,
	scope,
	isSearching,
	onClearScope,
	onSearchChange,
}: AppCommandPaletteSearchInputProps): React.JSX.Element {
	return (
		<div className="px-4 pt-3 pb-2">
			<div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3.5 py-2.5 shadow-sm transition-all focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
				<Search className="size-4 shrink-0 text-muted-foreground/50 dark:text-muted-foreground/60" />

				{/* Scope badge */}
				{showScopeBadge ? (
					<Button
						type="button"
						variant="secondary"
						size="xs"
						onClick={onClearScope}
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
					onValueChange={onSearchChange}
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
	);
}

// ── Pinned Section ──────────────────────────────────────────────────────────

export interface AppCommandPalettePinnedSectionProps {
	readonly pinnedItems: readonly PaletteSearchableItem[];
	readonly showDivider: boolean;
	readonly renderIcon: (iconName: string | undefined, className: string) => React.ReactNode;
	readonly onSelectChip: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function AppCommandPalettePinnedSection({ pinnedItems, showDivider, renderIcon, onSelectChip }: AppCommandPalettePinnedSectionProps): React.JSX.Element {
	return (
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
						onClick={onSelectChip}
						className="gap-1.5 rounded-lg border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground/80 hover:border-border hover:bg-muted hover:text-foreground dark:text-muted-foreground/70">
						{renderIcon(pinned.icon, "size-3")}
						<span className="max-w-28 truncate">{pinned.title}</span>
					</Button>
				))}
			</div>
			{showDivider ? (
				<div className="px-4 py-1">
					<div className="h-px bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent" />
				</div>
			) : null}
		</div>
	);
}

// ── Recent Section ──────────────────────────────────────────────────────────

export interface AppCommandPaletteRecentSectionProps {
	readonly recentSearches: readonly PaletteRecentSearch[];
	readonly showDivider: boolean;
	readonly renderIcon: (iconName: string | undefined, className: string) => React.ReactNode;
	readonly onSelectChip: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function AppCommandPaletteRecentSection({ recentSearches, showDivider, renderIcon, onSelectChip }: AppCommandPaletteRecentSectionProps): React.JSX.Element {
	return (
		<div className="animate-in pt-1 duration-300 fill-mode-both fade-in slide-in-from-bottom-1">
			<div className="flex items-center gap-1.5 px-4 py-1.5">
				<Clock className="size-3 text-muted-foreground/40" />
				<span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase dark:text-muted-foreground/60">Recent</span>
			</div>
			<div className="flex flex-wrap gap-1.5 px-4 pb-1">
				{recentSearches.map((recent) => (
					<Button
						key={recent.url}
						type="button"
						variant="outline"
						size="xs"
						data-url={recent.url}
						onClick={onSelectChip}
						className="gap-1.5 rounded-lg border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground/80 hover:border-border hover:bg-muted hover:text-foreground dark:text-muted-foreground/70">
						{renderIcon(recent.icon, "size-3")}
						<span className="max-w-28 truncate">{recent.title}</span>
					</Button>
				))}
			</div>
			{showDivider ? (
				<div className="px-4 py-1">
					<div className="h-px bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent" />
				</div>
			) : null}
		</div>
	);
}

// ── Quick Actions Section ─────────────────────────────────────────────────────

export interface AppCommandPaletteQuickActionsSectionProps {
	readonly actions: readonly AppCommandPaletteQuickAction[];
	readonly scope: keyof typeof scopeConfig;
	readonly isSearching: boolean;
	readonly effectiveQuery: string;
	readonly onSelectQuickAction: (value: string) => void;
}

export function AppCommandPaletteQuickActionsSection({
	actions,
	scope,
	isSearching,
	effectiveQuery,
	onSelectQuickAction,
}: AppCommandPaletteQuickActionsSectionProps): React.JSX.Element {
	return (
		<CommandGroup>
			<div className="flex items-center gap-1.5 px-4 py-2">
				<Zap className="size-3 text-muted-foreground/40" />
				<span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase dark:text-muted-foreground/60">
					{scope === "commands" ? "Commands" : "Quick Actions"}
				</span>
			</div>

			{actions.map((action) => {
				const Icon = action.icon;
				const shortcut = action.shortcut;
				return (
					<CommandItem
						key={action.id}
						value={action.id}
						onSelect={onSelectQuickAction}
						className="slide-in-from-bottom-0.5 flex animate-in items-center justify-between rounded-xl px-4 py-2.5 transition-all duration-75 fill-mode-both fade-in data-selected:bg-muted data-selected:text-foreground">
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", action.color)}>
								<Icon className="size-4" />
							</div>
							<div>
								<div className="text-sm leading-tight font-medium">{isSearching ? <>{highlightText(action.title, effectiveQuery, PALETTE_MARK_CLASS)}</> : action.title}</div>
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
	);
}

// ── Navigation Section ────────────────────────────────────────────────────────

export interface AppCommandPaletteNavigationSectionProps {
	readonly filteredGroups: Record<string, PaletteSearchableItem[]>;
	readonly collapsedSections: ReadonlySet<string>;
	readonly isSearching: boolean;
	readonly scope: keyof typeof scopeConfig;
	readonly effectiveQuery: string;
	readonly pinnedUrls: readonly string[];
	readonly renderIcon: (iconName: string | undefined, className: string) => React.ReactNode;
	readonly onToggleSection: (event: React.MouseEvent<HTMLButtonElement>) => void;
	readonly onSelectItem: (value: string) => void;
	readonly onTogglePin: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function AppCommandPaletteNavigationSection({
	filteredGroups,
	collapsedSections,
	isSearching,
	scope,
	effectiveQuery,
	pinnedUrls,
	renderIcon,
	onToggleSection,
	onSelectItem,
	onTogglePin,
}: AppCommandPaletteNavigationSectionProps): React.JSX.Element {
	return (
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
							onClick={onToggleSection}
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
												onSelect={onSelectItem}
												className="slide-in-from-bottom-0.5 flex animate-in items-center justify-between rounded-xl px-4 py-2.5 transition-all duration-75 fill-mode-both fade-in data-selected:bg-muted data-selected:text-foreground">
												<div className="flex min-w-0 flex-1 items-center gap-3">
													{itemIcon !== null ? (
														<div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors", getItemColor(item.title))}>{itemIcon}</div>
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
														onClick={onTogglePin}
														className={cn("size-5 opacity-0 transition-all group-hover/command-item:opacity-100 data-selected:opacity-100", isPinned && "opacity-100")}
														aria-label={isPinned ? `Unpin ${item.title}` : `Pin ${item.title}`}>
														<Pin className={cn("size-3 transition-colors", isPinned ? "text-primary" : "text-muted-foreground/40")} />
													</Button>

													{/* Section badge */}
													<span
														className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase", getSectionBadgeColor(section))}>
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
	);
}

// ── Empty State ───────────────────────────────────────────────────────────────

export interface AppCommandPaletteEmptyStateProps {
	readonly onClearSearch: () => void;
}

export function AppCommandPaletteEmptyState({ onClearSearch }: AppCommandPaletteEmptyStateProps): React.JSX.Element {
	return (
		<CommandEmpty>
			<div className="flex flex-col items-center gap-4 py-10">
				<div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60">
					<SearchX className="size-6 text-muted-foreground/40" />
				</div>
				<div className="max-w-60 text-center">
					<p className="text-sm font-medium text-foreground">No results found</p>
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground/60">
						Try adjusting your search terms or{" "}
						<Button type="button" variant="link" size="sm" onClick={onClearSearch} className="h-auto p-0 text-xs underline underline-offset-2 hover:no-underline">
							clear the filter
						</Button>{" "}
						to browse all pages
					</p>
				</div>
			</div>
		</CommandEmpty>
	);
}

// ── Suggestion ────────────────────────────────────────────────────────────────

export interface AppCommandPaletteSuggestionProps {
	readonly query: string;
	readonly suggestion: PaletteSearchableItem;
	readonly onSelectSuggestion: () => void;
}

export function AppCommandPaletteSuggestion({ query, suggestion, onSelectSuggestion }: AppCommandPaletteSuggestionProps): React.JSX.Element {
	return (
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
					onClick={onSelectSuggestion}
					className="mt-3 gap-2 rounded-xl bg-primary/10 px-4 py-2 text-primary hover:bg-primary/15">
					<ArrowRight className="size-4" />
					<span>Did you mean &ldquo;{suggestion.title}&rdquo;?</span>
				</Button>
			</div>
		</div>
	);
}

// ── Footer ────────────────────────────────────────────────────────────────────

export function AppCommandPaletteFooter(): React.JSX.Element {
	return (
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
				<kbd className="inline-flex h-4 items-center rounded-md bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">/</kbd>
				<kbd className="inline-flex h-4 items-center rounded-md bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">#</kbd>
				<span>prefix</span>
			</span>
		</div>
	);
}
