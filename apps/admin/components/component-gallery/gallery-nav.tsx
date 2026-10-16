"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { GALLERY_ENTRIES, GALLERY_FAMILIES, type GalleryComponentKey, type GalleryFamily, type GalleryFamilyId } from "@/components/component-gallery/gallery-catalog";
import { GALLERY_FAMILY_META } from "@/components/component-gallery/gallery-family-meta";
import { ROUTES } from "@/lib/routes";

/** A family with only the components that match the search. */
interface FilteredFamily {
	readonly family: GalleryFamily;
	readonly keys: readonly GalleryComponentKey[];
}

/** The families whose components' names contain `query` (case-insensitive); every family when the query is blank. */
export function filterGalleryFamilies(families: readonly GalleryFamily[], query: string): readonly FilteredFamily[] {
	const needle = query.trim().toLowerCase();
	return families
		.map((family: GalleryFamily): FilteredFamily => ({
			family,
			keys: needle === "" ? family.keys : family.keys.filter((key: GalleryComponentKey): boolean => GALLERY_ENTRIES[key].name.toLowerCase().includes(needle)),
		}))
		.filter(({ keys }: FilteredFamily): boolean => keys.length > 0);
}

/** The ring every focusable row of the navigation shows, inset so the scroll container never clips it. */
const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset";

function navLinkClassName(current: boolean): string {
	return cn(
		"block truncate rounded-md px-2.5 py-1.5 text-sm transition-colors",
		FOCUS_RING,
		current ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
	);
}

interface FamilyGroupProps {
	readonly family: GalleryFamily;
	readonly keys: readonly GalleryComponentKey[];
	readonly open: boolean;
	readonly onOpenChange: (familyId: GalleryFamilyId, open: boolean) => void;
	readonly pathname: string;
	readonly onNavigate: () => void;
}

/** One family: a title row that expands and collapses its components, as the app sidebar's groups do. */
function FamilyGroup({ family, keys, open, onOpenChange, pathname, onNavigate }: FamilyGroupProps): React.JSX.Element {
	const meta = GALLERY_FAMILY_META[family.id];
	const Icon = meta.icon;
	const handleOpenChange = React.useCallback(
		(next: boolean): void => {
			onOpenChange(family.id, next);
		},
		[family.id, onOpenChange],
	);
	return (
		<Collapsible open={open} onOpenChange={handleOpenChange}>
			<CollapsibleTrigger
				className={cn(
					"group/family flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent/60",
					FOCUS_RING,
				)}>
				<Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate text-start">{family.title}</span>
				<span className="text-xs font-normal text-muted-foreground tabular-nums">{keys.length}</span>
				<ChevronRight
					aria-hidden="true"
					className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/family:rotate-90 motion-reduce:transition-none"
				/>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ul className="ms-4.5 mt-0.5 mb-1 flex flex-col gap-0.5 border-s ps-2">
					{keys.map((key: GalleryComponentKey): React.JSX.Element => {
						const entry = GALLERY_ENTRIES[key];
						const href = ROUTES.components.component(entry.slug);
						const current = pathname === href;
						return (
							<li key={key}>
								<Link href={href} aria-current={current ? "page" : undefined} onClick={onNavigate} className={navLinkClassName(current)}>
									{entry.name}
								</Link>
							</li>
						);
					})}
				</ul>
			</CollapsibleContent>
		</Collapsible>
	);
}

/** The families the current page belongs to start expanded; the rest start collapsed. */
function initiallyOpenFamilies(pathname: string): ReadonlySet<GalleryFamilyId> {
	const current = GALLERY_FAMILIES.find((family: GalleryFamily): boolean =>
		family.keys.some((key: GalleryComponentKey): boolean => ROUTES.components.component(GALLERY_ENTRIES[key].slug) === pathname),
	);
	return new Set<GalleryFamilyId>(current === undefined ? GALLERY_FAMILIES.map((family: GalleryFamily): GalleryFamilyId => family.id) : [current.id]);
}

/**
 * The gallery's side navigation: every component by family, each family
 * collapsible, with a filter box. While a filter is typed every matching
 * family is shown expanded. The current page's link is marked
 * `aria-current="page"`.
 */
export interface GalleryNavProps {
	/** Called when a link is followed — the mobile sheet closes on it. */
	readonly onNavigate?: () => void;
}

export function GalleryNav({ onNavigate }: GalleryNavProps): React.JSX.Element {
	const pathname = usePathname();
	const [query, setQuery] = React.useState("");
	const [openFamilies, setOpenFamilies] = React.useState<ReadonlySet<GalleryFamilyId>>((): ReadonlySet<GalleryFamilyId> => initiallyOpenFamilies(pathname));
	const families = React.useMemo((): readonly FilteredFamily[] => filterGalleryFamilies(GALLERY_FAMILIES, query), [query]);
	const isFiltering = query.trim() !== "";
	const handleNavigate = React.useCallback((): void => {
		onNavigate?.();
	}, [onNavigate]);

	const handleQueryChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setQuery(event.target.value);
	}, []);
	const handleClear = React.useCallback((): void => {
		setQuery("");
	}, []);
	const handleFamilyOpenChange = React.useCallback((familyId: GalleryFamilyId, open: boolean): void => {
		setOpenFamilies((previous: ReadonlySet<GalleryFamilyId>): ReadonlySet<GalleryFamilyId> => {
			const next = new Set<GalleryFamilyId>(previous);
			if (open) {
				next.add(familyId);
			} else {
				next.delete(familyId);
			}
			return next;
		});
	}, []);

	return (
		<nav aria-label="Components" className="flex flex-col gap-3">
			<InputGroup>
				<InputGroupAddon>
					<Search aria-hidden="true" />
				</InputGroupAddon>
				<InputGroupInput value={query} onChange={handleQueryChange} placeholder="Filter components" aria-label="Filter components" />
				{isFiltering ? (
					<InputGroupAddon align="inline-end">
						<InputGroupButton size="icon-xs" aria-label="Clear the filter" onClick={handleClear}>
							<X aria-hidden="true" />
						</InputGroupButton>
					</InputGroupAddon>
				) : null}
			</InputGroup>
			<Link
				href={ROUTES.components.index}
				aria-current={pathname === ROUTES.components.index ? "page" : undefined}
				onClick={handleNavigate}
				className={cn(navLinkClassName(pathname === ROUTES.components.index), "font-semibold")}>
				Overview
			</Link>
			<div className="flex flex-col gap-1">
				{families.map(({ family, keys }: FilteredFamily): React.JSX.Element => (
					<FamilyGroup
						key={family.id}
						family={family}
						keys={keys}
						open={isFiltering || openFamilies.has(family.id)}
						onOpenChange={handleFamilyOpenChange}
						pathname={pathname}
						onNavigate={handleNavigate}
					/>
				))}
				{families.length === 0 ? <p className="px-2.5 py-1.5 text-sm text-muted-foreground">No component matches.</p> : null}
			</div>
		</nav>
	);
}
