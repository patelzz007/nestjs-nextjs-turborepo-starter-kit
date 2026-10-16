"use client";

import * as React from "react";
import {
	AlertCircleIcon,
	BarChart3Icon,
	BookmarkIcon,
	CircleCheckIcon,
	DatabaseIcon,
	FileTextIcon,
	GlobeIcon,
	LoaderCircleIcon,
	PackageIcon,
	PaletteIcon,
	SearchIcon,
	SmartphoneIcon,
	TerminalIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
} from "@workspace/ui/components/sidebar";

import {
	SIDEBAR_EXAMPLE_FRAME_CLASS_NAME,
	SIDEBAR_EXAMPLE_PANEL_CLASS_NAME,
	SIDEBAR_EXAMPLE_STORAGE,
} from "@/components/component-gallery/examples/sidebar/sidebar-example-frame";

interface Project {
	readonly id: string;
	readonly name: string;
	readonly open: number;
	readonly icon: ReactNode;
}

interface PinnedProject {
	readonly id: string;
	readonly name: string;
}

interface Run {
	readonly id: string;
	readonly label: string;
	readonly time: string;
	readonly failed?: boolean;
}

/** How long the simulated refresh keeps the list in its loading state. */
const REFRESH_DURATION_MS = 900;

/**
 * One stable key per skeleton row while the list refreshes. Six rows is
 * roughly what the loaded list runs to, so the panel does not jump height.
 */
const SKELETON_ROW_IDS: readonly string[] = ["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4", "skeleton-5", "skeleton-6"];

// Demo data only: every row is a button, so nothing here invents a route or an
// endpoint on the way into someone else's app.
const PINNED: readonly PinnedProject[] = [
	{ id: "checkout", name: "Checkout API" },
	{ id: "design-system", name: "Design system" },
	{ id: "status", name: "Status page" },
];

// Icons are JSX nodes with a STATIC name per library, which is the shape
// `shadcn add` rewrites when it swaps in whichever icon package the installing
// project already uses.
const PROJECTS: readonly Project[] = [
	{
		id: "checkout",
		name: "Checkout API",
		open: 8,
		icon: <PackageIcon aria-hidden="true" />,
	},
	{
		id: "design-system",
		name: "Design system",
		open: 3,
		icon: <PaletteIcon aria-hidden="true" />,
	},
	{
		id: "edge-cache",
		name: "Edge cache",
		open: 2,
		icon: <GlobeIcon aria-hidden="true" />,
	},
	{
		id: "growth",
		name: "Growth experiments",
		open: 11,
		icon: <BarChart3Icon aria-hidden="true" />,
	},
	{
		id: "marketing",
		name: "Marketing site",
		open: 4,
		icon: <FileTextIcon aria-hidden="true" />,
	},
	{
		id: "mobile",
		name: "Mobile client",
		open: 6,
		icon: <SmartphoneIcon aria-hidden="true" />,
	},
	{
		id: "payments",
		name: "Payments ledger",
		open: 1,
		icon: <DatabaseIcon aria-hidden="true" />,
	},
	{
		id: "search",
		name: "Search index",
		open: 5,
		icon: <TerminalIcon aria-hidden="true" />,
	},
];

const RUNS: readonly Run[] = [
	{ id: "r-311", label: "Nightly contract tests", time: "08:12" },
	{ id: "r-310", label: "Payment webhook replay", time: "07:40", failed: true },
	{ id: "r-309", label: "Index rebuild", time: "06:55" },
	{ id: "r-308", label: "Locale export", time: "06:02" },
];

// Pinned rows sit above the filter's reach on purpose: a query that matches
// nothing still leaves a usable panel instead of an empty column.
function PinnedProjects(): React.JSX.Element {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Pinned</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{PINNED.map((project) => (
						<SidebarMenuItem key={project.id}>
							<SidebarMenuButton>
								<BookmarkIcon aria-hidden="true" />
								<span>{project.name}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

// One recent run. Glyph and colour both carry the outcome visually, which is
// what makes the row readable without colour vision; neither reaches a screen
// reader, so the `sr-only` word is what does.
interface RunRowProps {
	readonly run: Run;
}

function RunRow({ run }: RunRowProps): React.JSX.Element {
	return (
		<div className="flex items-center gap-2 text-sm">
			{run.failed === true ? (
				<AlertCircleIcon className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
			) : (
				<CircleCheckIcon className="size-3.5 shrink-0 text-success" aria-hidden="true" />
			)}
			<span className="sr-only">{run.failed === true ? "Failed" : "Succeeded"}</span>
			<span className="min-w-0 flex-1 truncate">{run.label}</span>
			<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{run.time}</span>
		</div>
	);
}

// The filter field. It boots empty, so the unfiltered list is what a visitor
// sees first, and the clear button only exists while there is something to
// clear rather than sitting there permanently disabled.
//
// Both affordances sit in an InputGroupAddon rather than on top of the input.
// The addon reserves real space in the group and the input's padding follows
// it, so neither the icon nor the clear button can ever overlap typed text the
// way an absolutely positioned overlay would.
interface ProjectFilterProps {
	readonly query: string;
	readonly onChange: (value: string) => void;
}

/** Keeps Enter in the filter field from submitting the page. */
function preventSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
	event.preventDefault();
}

function ProjectFilter({ query, onChange }: ProjectFilterProps): React.JSX.Element {
	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(event.target.value);
		},
		[onChange],
	);

	const handleClear = useCallback((): void => {
		onChange("");
	}, [onChange]);

	return (
		/*
      The form and the `py-0` group are shadcn's own SearchForm shape
      (blocks/sidebar-05): the form gives Enter somewhere to go instead of
      submitting the page, and the group lines the field up with the panel's
      gutter rather than the header's padding.
    */
		<form onSubmit={preventSubmit}>
			<SidebarGroup className="py-0">
				<SidebarGroupContent>
					<InputGroup>
						<InputGroupAddon>
							<SearchIcon aria-hidden="true" />
						</InputGroupAddon>
						<InputGroupInput value={query} onChange={handleChange} placeholder="Filter projects" aria-label="Filter projects" />
						{query === "" ? null : (
							<InputGroupAddon align="inline-end">
								<InputGroupButton size="icon-xs" aria-label="Clear filter" onClick={handleClear}>
									<XIcon aria-hidden="true" />
								</InputGroupButton>
							</InputGroupAddon>
						)}
					</InputGroup>
				</SidebarGroupContent>
			</SidebarGroup>
		</form>
	);
}

// The three states one list can be in. Six skeleton rows is roughly what the
// loaded list runs to, so the panel does not jump height while a refresh is in
// flight, and `aria-busy` tells assistive technology the rows are stale rather
// than gone.
//
// The empty message sits OUTSIDE SidebarMenu. That element is a `ul`, and a
// paragraph is not a permitted child of one.
interface ProjectListProps {
	readonly projects: readonly Project[];
	readonly loading: boolean;
	readonly query: string;
	readonly onRefresh: () => void;
}

function ProjectList({ projects, loading, query, onRefresh }: ProjectListProps): React.JSX.Element {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>All projects</SidebarGroupLabel>
			<SidebarGroupAction type="button" onClick={onRefresh}>
				<LoaderCircleIcon className={cn("size-4", loading ? "animate-spin" : null)} aria-hidden="true" />
				<span className="sr-only">Refresh projects</span>
			</SidebarGroupAction>
			<SidebarGroupContent>
				<SidebarMenu aria-busy={loading}>
					{loading
						? SKELETON_ROW_IDS.map((rowId) => (
								<SidebarMenuItem key={rowId}>
									<SidebarMenuSkeleton showIcon />
								</SidebarMenuItem>
							))
						: projects.map((project) => (
								<SidebarMenuItem key={project.id}>
									<SidebarMenuButton>
										{project.icon}
										<span>{project.name}</span>
									</SidebarMenuButton>
									<SidebarMenuBadge>{project.open}</SidebarMenuBadge>
								</SidebarMenuItem>
							))}
				</SidebarMenu>
				{!loading && projects.length === 0 ? (
					<p className="px-2 py-6 text-center text-xs text-sidebar-foreground/70">
						No projects match <span className="text-sidebar-foreground">{query}</span>.
					</p>
				) : null}
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

// The page beside the panel. The run list is a Card rather than a div with a
// border and a radius, because a literal `rounded-lg` is square in lyra and
// sera and much rounder in maia and luma: only a component resolves the panel
// correctly under all eight styles.
function ProjectOverview(): React.JSX.Element {
	return (
		<SidebarInset className="min-w-0 overflow-hidden">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
				<SidebarTrigger className="-ms-1" />
				<h2 className="truncate text-sm font-medium">Checkout API</h2>
				<span className="ml-auto shrink-0 text-xs text-muted-foreground">Updated 4m ago</span>
			</header>

			<div className="min-w-0 flex-1 overflow-auto p-4">
				<Card size="sm">
					<CardHeader>
						<CardTitle>Recent runs</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col gap-2.5">
							{RUNS.map((run) => (
								<RunRow key={run.id} run={run} />
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</SidebarInset>
	);
}

// A filter field, a loading state and an empty state, which is the set a real
// sidebar needs and a demo usually skips.
//
// The visible list is derived during render from the query. Nothing copies the
// result into state, so there is no second source of truth to fall out of step.
//
// The refresh is an event handler, not an effect, so the panel boots LOADED and
// the skeletons are something the reader triggers. That also keeps
// SidebarMenuSkeleton out of the first paint, which matters because it picks a
// random width in a useState initializer and would otherwise differ between the
// server and the client render. The only effect in the file clears the pending
// timer, so a refresh can never land on an unmounted panel.
//
// `collapsible="none"` is the one Sidebar branch with no media query in it, so
// the panel is identical at every frame width. It ignores the open state too,
// which is why no SidebarTrigger appears here.
//
// `min-h-0` beside the height is load-bearing. SidebarProvider ships
// `min-h-svh`, and tailwind-merge only drops it when another `min-h-*` arrives
// with it, so without the pair the example is viewport tall inside its frame.
export function Sidebar5Example(): React.JSX.Element {
	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect((): (() => void) => {
		return (): void => {
			if (timer.current !== null) {
				clearTimeout(timer.current);
			}
		};
	}, []);

	const startRefresh = useCallback((): void => {
		if (timer.current !== null) {
			clearTimeout(timer.current);
		}

		setLoading(true);
		timer.current = setTimeout((): void => {
			setLoading(false);
		}, REFRESH_DURATION_MS);
	}, []);

	const needle = query.trim().toLowerCase();
	const visible = useMemo((): readonly Project[] => PROJECTS.filter((project) => project.name.toLowerCase().includes(needle)), [needle]);

	return (
		<SidebarProvider storage={SIDEBAR_EXAMPLE_STORAGE} className={SIDEBAR_EXAMPLE_FRAME_CLASS_NAME}>
			{/*
        NOT `collapsible="none"`. That branch is a bare
        `flex h-full w-(--sidebar-width) flex-col bg-sidebar` with no border, so
        against a page background this close to `--sidebar` the panel and the
        content blur into one another. Only the desktop branch draws
        `group-data-[side=left]:border-r`, and it is the branch the framed
        preview always takes, so the divider is real rather than hand-painted.
        `absolute h-full` pins that branch's `fixed inset-y-0 h-svh` container
        back inside the example.
      */}
			<Sidebar className={SIDEBAR_EXAMPLE_PANEL_CLASS_NAME}>
				<SidebarHeader>
					<ProjectFilter query={query} onChange={setQuery} />
				</SidebarHeader>

				<SidebarContent role="navigation" aria-label="Projects">
					<PinnedProjects />
					{/*
            `mx-0` is a fix, not a preference. SidebarSeparator ships `w-auto`
            to undo Separator's `data-horizontal:w-full`, but a variant
            selector outranks a plain utility, so the rule stays full width and
            the primitive's own `mx-2` then pushes it 8px past the panel's
            right edge. In this scrolling content that is 16px of horizontal
            scroll on the whole nav; in the footer it is a rule that misses the
            left gutter and overhangs the right.
          */}
					<SidebarSeparator className="mx-0" />
					<ProjectList projects={visible} loading={loading} query={query} onRefresh={startRefresh} />
				</SidebarContent>

				<SidebarFooter>
					<SidebarSeparator className="mx-0" />
					<p className="px-2 text-xs text-sidebar-foreground/70">Free plan, 8 of 10 projects</p>
					<Button variant="outline" size="sm" className="w-full">
						Upgrade plan
					</Button>
				</SidebarFooter>
			</Sidebar>

			<ProjectOverview />
		</SidebarProvider>
	);
}
