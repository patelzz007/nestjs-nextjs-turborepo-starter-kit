"use client";

import * as React from "react";
import { BookOpenIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@workspace/ui/lib/core/utils";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
} from "@workspace/ui/components/sidebar";

import { SIDEBAR_EXAMPLE_FRAME_CLASS_NAME, SIDEBAR_EXAMPLE_STORAGE } from "@/components/component-gallery/examples/sidebar/sidebar-example-frame";

interface DocChild {
	readonly id: string;
	readonly label: string;
	readonly isActive?: boolean;
}

interface DocItem {
	readonly id: string;
	readonly label: string;
	readonly isActive?: boolean;
	readonly children?: readonly DocChild[];
}

interface DocSection {
	readonly id: string;
	readonly label: string;
	readonly items: readonly DocItem[];
}

interface VisibleSection {
	readonly section: DocSection;
	readonly items: readonly DocItem[];
}

const SECTIONS: readonly DocSection[] = [
	{
		id: "start",
		label: "Getting started",
		items: [
			{ id: "install", label: "Installation" },
			{ id: "structure", label: "Project structure" },
			{ id: "theming", label: "Theming" },
		],
	},
	{
		id: "components",
		label: "Components",
		items: [
			{
				id: "sidebar",
				label: "Sidebar",
				children: [
					{ id: "anatomy", label: "Anatomy", isActive: true },
					{ id: "collapsing", label: "Collapsing" },
					{ id: "sub-menus", label: "Sub-menus" },
				],
			},
			{
				id: "data-grid",
				label: "Data grid",
				children: [
					{ id: "columns", label: "Columns" },
					{ id: "row-selection", label: "Row selection" },
					{ id: "virtualisation", label: "Virtualisation" },
				],
			},
			{
				id: "filters",
				label: "Filters",
				children: [
					{ id: "operators", label: "Operators" },
					{ id: "async-options", label: "Async options" },
				],
			},
			{ id: "calendar", label: "Calendar" },
		],
	},
	{
		id: "api",
		label: "API reference",
		items: [
			{
				id: "provider",
				label: "Provider props",
				children: [
					{ id: "open-state", label: "Open state" },
					{ id: "widths", label: "Widths" },
				],
			},
			{
				id: "hooks",
				label: "Hooks",
				children: [{ id: "use-sidebar", label: "useSidebar" }],
			},
			{ id: "tokens", label: "CSS variables" },
		],
	},
];

function matches(label: string, query: string): boolean {
	return label.toLowerCase().includes(query);
}

// A parent that matches keeps all of its children, so searching "sidebar"
// still shows the whole page tree under it. A parent that does not match
// survives only through the children that do, and drops out when none are
// left. Both cases are computed during render, never mirrored into state.
function filterItems(items: readonly DocItem[], query: string): readonly DocItem[] {
	if (query === "") {
		return items;
	}

	const survivors: DocItem[] = [];
	for (const item of items) {
		if (matches(item.label, query)) {
			survivors.push(item);
			continue;
		}
		const children = item.children?.filter((child) => matches(child.label, query)) ?? [];
		if (children.length > 0) {
			survivors.push({ ...item, children });
		}
	}
	return survivors;
}

function isCurrentTrail(item: DocItem): boolean {
	return item.isActive === true || (item.children?.some((child) => child.isActive === true) ?? false);
}

// The product mark: a neutral icon tile on the sidebar's primary colour, so it
// recolours with the panel and needs no asset.
function BrandMark(): React.JSX.Element {
	return (
		<span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
			<BookOpenIcon className="size-3.5" />
		</span>
	);
}

// The chevron turns from a local boolean rather than from an open-state data
// attribute. Base emits `data-open` where radix emits `data-state="open"`, so
// reading the attribute would be the one line the two twins could not share.
interface ChevronProps {
	readonly open: boolean;
}

function Chevron({ open }: ChevronProps): React.JSX.Element {
	return <ChevronRightIcon className={cn("ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200", open ? "rotate-90" : null)} aria-hidden="true" />;
}

// A page, or a page with a sub-tree under it. The open state is seeded in the
// useState INITIALIZER from whichever child is current, so the active trail is
// already expanded on the first paint and no effect ever has to re-derive it.
//
// SidebarMenuButton truncates `[&>span:last-child]` only, and on a disclosure
// row the last child is the chevron. The label therefore has to ask for
// `min-w-0 flex-1 truncate` itself, or a long page title grows past the
// button's overflow-hidden edge and takes the chevron with it.
interface DocsNavItemProps {
	readonly item: DocItem;
	readonly forceOpen: boolean;
}

function DocsNavItem({ item, forceOpen }: DocsNavItemProps): React.JSX.Element {
	const [open, setOpen] = useState(() => item.children?.some((child) => child.isActive === true) ?? false);
	const handleToggle = useCallback((): void => {
		setOpen((value) => !value);
	}, []);

	const { children = [] } = item;
	if (children.length === 0) {
		return (
			<SidebarMenuItem>
				<SidebarMenuButton isActive={item.isActive ?? false}>
					<span>{item.label}</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	}

	const expanded = forceOpen || open;

	return (
		<SidebarMenuItem>
			<SidebarMenuButton type="button" onClick={handleToggle} aria-expanded={expanded} aria-controls={`docs-sub-${item.id}`}>
				<span className="min-w-0 flex-1 truncate">{item.label}</span>
				<Chevron open={expanded} />
			</SidebarMenuButton>
			{expanded ? (
				<SidebarMenuSub id={`docs-sub-${item.id}`}>
					{children.map((child) => (
						<SidebarMenuSubItem key={child.id}>
							<SidebarMenuSubButton isActive={child.isActive ?? false}>
								<span>{child.label}</span>
							</SidebarMenuSubButton>
						</SidebarMenuSubItem>
					))}
				</SidebarMenuSub>
			) : null}
		</SidebarMenuItem>
	);
}

// A section, collapsible from its own label, composed the way shadcn's own
// sidebar docs compose one: a Collapsible wrapping the SidebarGroup, the label
// rendered AS the trigger, and the body in CollapsibleContent. Driving it from
// a hand-rolled button meant writing aria-expanded and aria-controls by hand;
// the trigger supplies both.
//
// Controlled rather than `defaultOpen`, because the filter field also forces a
// section open: while it has text in it every surviving section is expanded, so
// a match can never hide behind a collapsed heading.
//
// The hover classes are deliberate. SidebarGroupLabel renders a div by default
// and exposes no variant for an interactive one, so a label that became a
// trigger has to say for itself that it is pressable.
//
// `text-start` on the name is load-bearing, not decoration. The trigger is a
// <button>, a button's UA style is `text-align: center`, and the name sits in a
// `flex-1` span so it spans the row: without it every heading renders centred
// while the chevron stays hard right. SidebarGroupLabel has no overflow
// handling of its own either, which is why the span truncates.
interface DocsSectionProps {
	readonly section: DocSection;
	readonly items: readonly DocItem[];
	readonly filtering: boolean;
}

function DocsSection({ section, items, filtering }: DocsSectionProps): React.JSX.Element {
	const [open, setOpen] = useState(() => section.items.some(isCurrentTrail));

	const expanded = filtering || open;

	return (
		<Collapsible open={expanded} onOpenChange={setOpen}>
			<SidebarGroup>
				<SidebarGroupLabel render={<CollapsibleTrigger />} className="w-full hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
					<span className="min-w-0 flex-1 truncate text-start">{section.label}</span>
					<Chevron open={expanded} />
				</SidebarGroupLabel>
				<CollapsibleContent>
					<SidebarGroupContent>
						<SidebarMenu>
							{items.map((item) => (
								<DocsNavItem key={item.id} item={item} forceOpen={filtering} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	);
}

// Two levels of disclosure in one panel: sections that collapse from their own
// label, and a SidebarMenuSub tree under any page that has one.
//
// The filter field owns the only other piece of state. Everything it affects,
// which sections survive, which pages survive and which trees are forced open,
// is derived from it during render, so there is nothing to keep in sync.
//
// `collapsible="none"` is the one Sidebar branch with no media query in it, so
// the panel is identical at every frame width. It also ignores the open state
// entirely, which is why no SidebarTrigger appears here: it would toggle
// something this branch never reads.
//
// `min-h-0` beside the height is load-bearing. SidebarProvider ships
// `min-h-svh`, and tailwind-merge only drops it when another `min-h-*` arrives
// with it, so without the pair the example is viewport tall inside its frame.
export function Sidebar3Example(): React.JSX.Element {
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();

	const visible = useMemo(
		(): readonly VisibleSection[] =>
			SECTIONS.map((section) => ({
				section,
				items: filterItems(section.items, needle),
			})).filter((entry) => entry.items.length > 0),
		[needle],
	);

	const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setQuery(event.target.value);
	}, []);

	return (
		<SidebarProvider storage={SIDEBAR_EXAMPLE_STORAGE} className={SIDEBAR_EXAMPLE_FRAME_CLASS_NAME}>
			<Sidebar collapsible="none">
				<SidebarHeader>
					<div className="flex items-center gap-2">
						<BrandMark />
						<span className="truncate text-sm font-medium">Northwind Docs</span>
						<span className="ml-auto shrink-0 text-xs text-sidebar-foreground/70">v2.8</span>
					</div>
					<label htmlFor="docs-search" className="sr-only">
						Search the documentation
					</label>
					<SidebarInput id="docs-search" value={query} onChange={handleQueryChange} placeholder="Search docs" />
				</SidebarHeader>

				<SidebarContent role="navigation" aria-label="Documentation">
					{visible.map((entry) => (
						<DocsSection key={entry.section.id} section={entry.section} items={entry.items} filtering={needle !== ""} />
					))}
					{visible.length === 0 ? (
						<p className="px-4 py-6 text-center text-xs text-sidebar-foreground/70">
							No pages match <span className="text-sidebar-foreground">{query}</span>.
						</p>
					) : null}
				</SidebarContent>
			</Sidebar>

			<SidebarInset className="min-w-0 overflow-auto">
				<article className="mx-auto w-full max-w-2xl px-6 py-6">
					<h3 className="text-xl font-semibold tracking-tight">Sidebar anatomy</h3>
					<p className="mt-2 text-sm text-muted-foreground">
						A sidebar is a provider, a panel and the inset beside it. The provider owns the open state and the widths, the panel owns the navigation, and the inset is the page
						the reader came for.
					</p>

					<h4 className="mt-6 text-base font-medium">Where the parts go</h4>
					<p className="mt-2 text-sm text-muted-foreground">
						Header and footer are pinned; only the content between them scrolls. Groups carry the labels, menus carry the rows, and a sub-menu nests one level under the row
						that owns it.
					</p>
					<p className="mt-2 text-sm text-muted-foreground">Keep the panel to one job. A tree that needs three levels of indentation usually wants a page of its own.</p>

					<ul className="mt-4 flex list-disc flex-col gap-1.5 ps-5 text-sm text-muted-foreground">
						<li>One landmark per panel, labelled for screen readers.</li>
						<li>Every disclosure reports aria-expanded and what it controls.</li>
						<li>The current page is marked once, at the deepest level.</li>
					</ul>
				</article>
			</SidebarInset>
		</SidebarProvider>
	);
}
