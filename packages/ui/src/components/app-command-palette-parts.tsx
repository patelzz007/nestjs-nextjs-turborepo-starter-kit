"use client";

import { Command as CommandPrimitive } from "cmdk";
import { ArrowRight, ChevronDown, ChevronRight, Clock, FileText, Pin, Search, SearchX, X, Zap } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { CommandEmpty, CommandGroup, CommandItem } from "@workspace/ui/components/command";
import { highlightText } from "@workspace/ui/lib/core/highlight-text";
import type { AppCommandPaletteLabels } from "@workspace/ui/lib/palette/labels";
import type { ScopeType } from "@workspace/ui/lib/palette/search";
import { getDefaultIconColor, getItemColor, getSectionBadgeColor, PALETTE_MARK_CLASS } from "@workspace/ui/lib/palette/styles";
import type { PaletteRecentSearch, PaletteSearchableItem } from "@workspace/ui/lib/palette/types";
import { cn } from "@workspace/ui/lib/core/utils";

export interface AppCommandPaletteQuickAction {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly icon: React.ComponentType<{ readonly className?: string }>;
	readonly color: string;
	readonly keywords?: readonly string[];
	readonly run: () => void;
}

/** Scope chip tints — tone tokens (tokens.css), so they theme and keep AA text contrast in both modes. */
const SCOPE_BADGE_CLASS: Readonly<Record<ScopeType, string>> = {
	all: "",
	commands: "bg-tone-blue-soft text-tone-blue",
	files: "bg-tone-green-soft text-tone-green",
	settings: "bg-tone-violet-soft text-tone-violet",
};

/** Uppercase overline that heads each palette group. */
const SECTION_TITLE_CLASS = "text-(length:--text-overline) font-semibold tracking-widest text-muted-foreground uppercase";

/** Footer key caps. */
const FOOTER_KBD_CLASS =
	"inline-flex h-4 min-w-4.5 items-center justify-center rounded-md bg-muted px-1 font-mono text-(length:--text-micro) font-medium text-muted-foreground";

const FOOTER_HINT_CLASS = "flex items-center gap-1.5 text-(length:--text-overline) text-muted-foreground";

const LIST_ITEM_CLASS =
	"slide-in-from-bottom-0.5 flex animate-in items-center justify-between rounded-xl px-4 py-2.5 transition-all duration-75 fill-mode-both fade-in data-selected:bg-muted data-selected:text-foreground";

const CHIP_CLASS = "gap-1.5 rounded-lg border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground";

/** The two grid-row states a palette section animates between when collapsed — hoisted, never rebuilt per render. */
const SECTION_OPEN_STYLE: React.CSSProperties = { gridTemplateRows: "1fr" };
const SECTION_COLLAPSED_STYLE: React.CSSProperties = { gridTemplateRows: "0fr" };

/** A soft fading hairline between palette groups. */
export function AppCommandPaletteDivider(): React.JSX.Element {
	return (
		<div className="px-4 py-1">
			<div className="h-px bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent" />
		</div>
	);
}

// ── Search Input ────────────────────────────────────────────────────────────

export interface AppCommandPaletteSearchInputProps {
	readonly inputRef: React.RefObject<HTMLInputElement | null>;
	readonly placeholder: string;
	readonly searchText: string;
	readonly showScopeBadge: boolean;
	readonly scope: ScopeType;
	readonly isSearching: boolean;
	readonly onClearScope: () => void;
	readonly onSearchChange: (value: string) => void;
	readonly labels: Pick<AppCommandPaletteLabels, "scopeLabels" | "clearScopeAriaLabel" | "shortcutHint">;
}

export const AppCommandPaletteSearchInput = React.forwardRef<HTMLDivElement, AppCommandPaletteSearchInputProps>(function AppCommandPaletteSearchInput(
	{ inputRef, placeholder, searchText, showScopeBadge, scope, isSearching, onClearScope, onSearchChange, labels },
	ref,
): React.JSX.Element {
	const scopeLabel = labels.scopeLabels[scope];

	return (
		<div ref={ref} className="px-4 pt-3 pb-2">
			<div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3.5 py-2.5 shadow-sm transition-all focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
				<Search className="size-4 shrink-0 text-muted-foreground" />

				{/* Scope badge */}
				{showScopeBadge ? (
					<Button
						type="button"
						variant="secondary"
						size="xs"
						onClick={onClearScope}
						className={cn(
							"gap-1 rounded-lg px-2 py-0.5 text-(length:--text-chip) font-semibold tracking-wide uppercase transition-all hover:brightness-110",
							SCOPE_BADGE_CLASS[scope],
						)}
						aria-label={labels.clearScopeAriaLabel(scopeLabel)}>
						{scopeLabel}
						<X className="size-3" />
					</Button>
				) : null}

				<CommandPrimitive.Input
					ref={inputRef}
					placeholder={placeholder}
					value={searchText}
					onValueChange={onSearchChange}
					className="flex-1 bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground"
				/>

				{/* Shortcut hint */}
				{!isSearching ? (
					<kbd className="hidden h-5 items-center gap-0.5 rounded-md bg-muted px-1.5 font-mono text-(length:--text-kbd) font-medium text-muted-foreground sm:inline-flex">
						{labels.shortcutHint}
					</kbd>
				) : null}
			</div>
		</div>
	);
});

// ── Chip sections (pinned + recent) ─────────────────────────────────────────

interface PaletteChip {
	readonly key: string;
	readonly url: string;
	readonly title: string;
	readonly icon?: string | undefined;
}

interface AppCommandPaletteChipSectionProps {
	readonly title: string;
	readonly icon: React.ReactNode;
	readonly chips: readonly PaletteChip[];
	readonly showDivider: boolean;
	readonly renderIcon: (iconName: string | undefined, className: string) => React.ReactNode;
	readonly onSelectChip: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const AppCommandPaletteChipSection = React.forwardRef<HTMLDivElement, AppCommandPaletteChipSectionProps>(function AppCommandPaletteChipSection(
	{ title, icon, chips, showDivider, renderIcon, onSelectChip },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} className="animate-in pt-1 duration-300 fill-mode-both fade-in slide-in-from-bottom-1">
			<div className="flex items-center gap-1.5 px-4 py-1.5">
				{icon}
				<span className={SECTION_TITLE_CLASS}>{title}</span>
			</div>
			<div className="flex flex-wrap gap-1.5 px-4 pb-1">
				{chips.map((chip) => (
					<Button key={chip.key} type="button" variant="outline" size="xs" data-url={chip.url} onClick={onSelectChip} className={CHIP_CLASS}>
						{renderIcon(chip.icon, "size-3")}
						<span className="max-w-28 truncate">{chip.title}</span>
					</Button>
				))}
			</div>
			{showDivider ? <AppCommandPaletteDivider /> : null}
		</div>
	);
});

const PINNED_SECTION_ICON = <Pin className="size-3 text-muted-foreground" />;
const RECENT_SECTION_ICON = <Clock className="size-3 text-muted-foreground" />;

export interface AppCommandPalettePinnedSectionProps {
	readonly pinnedItems: readonly PaletteSearchableItem[];
	readonly showDivider: boolean;
	readonly renderIcon: (iconName: string | undefined, className: string) => React.ReactNode;
	readonly onSelectChip: (event: React.MouseEvent<HTMLButtonElement>) => void;
	readonly labels: Pick<AppCommandPaletteLabels, "pinnedSectionTitle">;
}

export const AppCommandPalettePinnedSection = React.forwardRef<HTMLDivElement, AppCommandPalettePinnedSectionProps>(function AppCommandPalettePinnedSection(
	{ pinnedItems, showDivider, renderIcon, onSelectChip, labels },
	ref,
): React.JSX.Element {
	const chips = React.useMemo((): readonly PaletteChip[] => pinnedItems.map((item) => ({ key: item.id, url: item.url, title: item.title, icon: item.icon })), [pinnedItems]);
	return (
		<AppCommandPaletteChipSection
			ref={ref}
			title={labels.pinnedSectionTitle}
			icon={PINNED_SECTION_ICON}
			chips={chips}
			showDivider={showDivider}
			renderIcon={renderIcon}
			onSelectChip={onSelectChip}
		/>
	);
});

export interface AppCommandPaletteRecentSectionProps {
	readonly recentSearches: readonly PaletteRecentSearch[];
	readonly showDivider: boolean;
	readonly renderIcon: (iconName: string | undefined, className: string) => React.ReactNode;
	readonly onSelectChip: (event: React.MouseEvent<HTMLButtonElement>) => void;
	readonly labels: Pick<AppCommandPaletteLabels, "recentSectionTitle">;
}

export const AppCommandPaletteRecentSection = React.forwardRef<HTMLDivElement, AppCommandPaletteRecentSectionProps>(function AppCommandPaletteRecentSection(
	{ recentSearches, showDivider, renderIcon, onSelectChip, labels },
	ref,
): React.JSX.Element {
	const chips = React.useMemo(
		(): readonly PaletteChip[] => recentSearches.map((recent) => ({ key: recent.url, url: recent.url, title: recent.title, icon: recent.icon })),
		[recentSearches],
	);
	return (
		<AppCommandPaletteChipSection
			ref={ref}
			title={labels.recentSectionTitle}
			icon={RECENT_SECTION_ICON}
			chips={chips}
			showDivider={showDivider}
			renderIcon={renderIcon}
			onSelectChip={onSelectChip}
		/>
	);
});

// ── Quick Actions Section ─────────────────────────────────────────────────────

export interface AppCommandPaletteQuickActionsSectionProps {
	readonly actions: readonly AppCommandPaletteQuickAction[];
	readonly scope: ScopeType;
	readonly isSearching: boolean;
	readonly effectiveQuery: string;
	readonly onSelectQuickAction: (value: string) => void;
	readonly labels: Pick<AppCommandPaletteLabels, "commandsSectionTitle" | "quickActionsSectionTitle">;
}

export const AppCommandPaletteQuickActionsSection = React.forwardRef<HTMLDivElement, AppCommandPaletteQuickActionsSectionProps>(function AppCommandPaletteQuickActionsSection(
	{ actions, scope, isSearching, effectiveQuery, onSelectQuickAction, labels },
	ref,
): React.JSX.Element {
	return (
		<CommandGroup ref={ref}>
			<div className="flex items-center gap-1.5 px-4 py-2">
				<Zap className="size-3 text-muted-foreground" />
				<span className={SECTION_TITLE_CLASS}>{scope === "commands" ? labels.commandsSectionTitle : labels.quickActionsSectionTitle}</span>
			</div>

			{actions.map((action) => {
				const Icon = action.icon;
				return (
					<CommandItem key={action.id} value={action.id} onSelect={onSelectQuickAction} className={LIST_ITEM_CLASS}>
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", action.color)}>
								<Icon className="size-4" />
							</div>
							<div>
								<div className="text-sm leading-tight font-medium">{isSearching ? <>{highlightText(action.title, effectiveQuery, PALETTE_MARK_CLASS)}</> : action.title}</div>
								<div className="mt-0.5 text-xs text-muted-foreground">
									{isSearching ? <>{highlightText(action.description, effectiveQuery, PALETTE_MARK_CLASS)}</> : action.description}
								</div>
							</div>
						</div>
					</CommandItem>
				);
			})}
		</CommandGroup>
	);
});

// ── Navigation Section ────────────────────────────────────────────────────────

export interface AppCommandPaletteNavigationSectionProps {
	readonly filteredGroups: Record<string, PaletteSearchableItem[]>;
	readonly collapsedSections: ReadonlySet<string>;
	readonly isSearching: boolean;
	readonly scope: ScopeType;
	readonly effectiveQuery: string;
	readonly pinnedUrls: readonly string[];
	readonly renderIcon: (iconName: string | undefined, className: string) => React.ReactNode;
	readonly onToggleSection: (event: React.MouseEvent<HTMLButtonElement>) => void;
	readonly onSelectItem: (value: string) => void;
	readonly onTogglePin: (event: React.MouseEvent<HTMLButtonElement>) => void;
	readonly labels: Pick<
		AppCommandPaletteLabels,
		"pagesSectionTitle" | "expandSectionAriaLabel" | "collapseSectionAriaLabel" | "pinItemAriaLabel" | "unpinItemAriaLabel" | "hiddenItemsCount"
	>;
}

export const AppCommandPaletteNavigationSection = React.forwardRef<HTMLDivElement, AppCommandPaletteNavigationSectionProps>(function AppCommandPaletteNavigationSection(
	{ filteredGroups, collapsedSections, isSearching, scope, effectiveQuery, pinnedUrls, renderIcon, onToggleSection, onSelectItem, onTogglePin, labels },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} className="pt-0.5 pb-1">
			{!isSearching && scope === "all" ? (
				<div className="flex items-center gap-1.5 px-4 py-2">
					<FileText className="size-3 text-muted-foreground" />
					<span className={SECTION_TITLE_CLASS}>{labels.pagesSectionTitle}</span>
				</div>
			) : null}

			{Object.entries(filteredGroups).map(([section, items]) => {
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
							aria-label={isCollapsed ? labels.expandSectionAriaLabel(section) : labels.collapseSectionAriaLabel(section)}>
							<span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{section}</span>
							<ChevronDown className={cn("size-3 text-muted-foreground transition-transform duration-150", isCollapsed && "-rotate-90")} />
						</Button>
						<div style={isCollapsed ? SECTION_COLLAPSED_STYLE : SECTION_OPEN_STYLE} className="grid transition-all duration-200 ease-out motion-reduce:transition-none">
							<div className="min-h-0 overflow-hidden">
								<CommandGroup className="mb-0.5">
									{items.map((item) => {
										const isPinned = pinnedUrls.includes(item.url);
										const itemIcon = renderIcon(item.icon, "size-4");
										return (
											<CommandItem key={item.id} value={item.url} onSelect={onSelectItem} className={LIST_ITEM_CLASS}>
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
																	<span key={`${crumb}-${String(i)}`} className="inline-flex items-center gap-1 text-(length:--text-overline) text-muted-foreground">
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
														aria-label={isPinned ? labels.unpinItemAriaLabel(item.title) : labels.pinItemAriaLabel(item.title)}>
														<Pin className={cn("size-3 transition-colors", isPinned ? "text-primary" : "text-muted-foreground")} />
													</Button>

													{/* Section badge */}
													<span
														className={cn(
															"inline-flex items-center rounded-md px-1.5 py-0.5 text-(length:--text-micro) font-medium tracking-wider uppercase",
															getSectionBadgeColor(),
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
							<div className="px-4 py-2 text-(length:--text-overline) text-muted-foreground italic">
								<hr className="mb-2 h-px bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent" />
								{labels.hiddenItemsCount(items.length)}
							</div>
						) : null}
					</React.Fragment>
				);
			})}
		</div>
	);
});

// ── Empty State ───────────────────────────────────────────────────────────────

export interface AppCommandPaletteEmptyStateProps {
	readonly onClearSearch: () => void;
	readonly labels: Pick<AppCommandPaletteLabels, "noResultsTitle" | "noResultsHintBefore" | "noResultsClearFilter" | "noResultsHintAfter">;
}

export const AppCommandPaletteEmptyState = React.forwardRef<HTMLDivElement, AppCommandPaletteEmptyStateProps>(function AppCommandPaletteEmptyState(
	{ onClearSearch, labels },
	ref,
): React.JSX.Element {
	return (
		<CommandEmpty ref={ref}>
			<div className="flex flex-col items-center gap-4 py-10">
				<div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60">
					<SearchX className="size-6 text-muted-foreground" />
				</div>
				<div className="max-w-60 text-center">
					<p className="text-sm font-medium text-foreground">{labels.noResultsTitle}</p>
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
						{labels.noResultsHintBefore}{" "}
						<Button type="button" variant="link" size="sm" onClick={onClearSearch} className="h-auto p-0 text-xs underline underline-offset-2 hover:no-underline">
							{labels.noResultsClearFilter}
						</Button>{" "}
						{labels.noResultsHintAfter}
					</p>
				</div>
			</div>
		</CommandEmpty>
	);
});

// ── Suggestion ────────────────────────────────────────────────────────────────

export interface AppCommandPaletteSuggestionProps {
	readonly query: string;
	readonly suggestion: PaletteSearchableItem;
	readonly onSelectSuggestion: () => void;
	readonly labels: Pick<AppCommandPaletteLabels, "noResultsForQuery" | "didYouMean">;
}

export const AppCommandPaletteSuggestion = React.forwardRef<HTMLDivElement, AppCommandPaletteSuggestionProps>(function AppCommandPaletteSuggestion(
	{ query, suggestion, onSelectSuggestion, labels },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} className="flex flex-col items-center gap-3 py-10">
			<div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60">
				<SearchX className="size-6 text-muted-foreground" />
			</div>
			<div className="max-w-64 text-center">
				<p className="text-sm font-medium text-foreground">{labels.noResultsForQuery(query)}</p>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					onClick={onSelectSuggestion}
					className="mt-3 gap-2 rounded-xl bg-primary/10 px-4 py-2 text-primary hover:bg-primary/15">
					<ArrowRight className="size-4" />
					<span>{labels.didYouMean(suggestion.title)}</span>
				</Button>
			</div>
		</div>
	);
});

// ── Footer ────────────────────────────────────────────────────────────────────

export interface AppCommandPaletteFooterProps {
	readonly labels: Pick<AppCommandPaletteLabels, "footerNavigate" | "footerOpen" | "footerClose" | "footerPrefix" | "escapeKey">;
}

export const AppCommandPaletteFooter = React.forwardRef<HTMLDivElement, AppCommandPaletteFooterProps>(function AppCommandPaletteFooter({ labels }, ref): React.JSX.Element {
	return (
		<div ref={ref} className="flex items-center justify-center gap-5 border-t border-border/40 bg-muted/30 px-4 py-2.5">
			<span className={FOOTER_HINT_CLASS}>
				<kbd className={FOOTER_KBD_CLASS}>↑↓</kbd>
				<span>{labels.footerNavigate}</span>
			</span>
			<span className={FOOTER_HINT_CLASS}>
				<kbd className={FOOTER_KBD_CLASS}>↵</kbd>
				<span>{labels.footerOpen}</span>
			</span>
			<span className={FOOTER_HINT_CLASS}>
				<kbd className={FOOTER_KBD_CLASS}>{labels.escapeKey}</kbd>
				<span>{labels.footerClose}</span>
			</span>
			<span className="mx-1 h-3 w-px bg-muted-foreground/10 dark:bg-muted-foreground/20" />
			<span className={FOOTER_HINT_CLASS}>
				<kbd className={FOOTER_KBD_CLASS}>{">"}</kbd>
				<kbd className={FOOTER_KBD_CLASS}>/</kbd>
				<kbd className={FOOTER_KBD_CLASS}>#</kbd>
				<span>{labels.footerPrefix}</span>
			</span>
		</div>
	);
});
