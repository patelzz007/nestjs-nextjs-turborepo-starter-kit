"use client";

import * as React from "react";
import {
	AppWindowIcon,
	BadgeCheckIcon,
	BookOpenIcon,
	BotIcon,
	CalendarDaysIcon,
	ChartBarIcon,
	ChevronsRightIcon,
	CircleUserRoundIcon,
	ClipboardListIcon,
	DownloadIcon,
	GitMergeIcon,
	GlobeIcon,
	KanbanIcon,
	LayersIcon,
	LayoutGridIcon,
	MoonIcon,
	MusicIcon,
	PaletteIcon,
	PuzzleIcon,
	RefreshCwIcon,
	RocketIcon,
	RouteIcon,
	SettingsIcon,
	SlidersHorizontalIcon,
	SparklesIcon,
	StarIcon,
	SunIcon,
	TableIcon,
	TagIcon,
	TerminalIcon,
	WrenchIcon,
	ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { Cascader, CascaderEmpty, CascaderList, CascaderPanel, CascaderStatus } from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";

import { Card } from "@workspace/ui/components/card";

/** The list scrolls past this height, in pixels. */
const LIST_MAX_HEIGHT_PX = 240;

/* -------------------------------------------------------------------------- */
/*                                Section icons                               */
/* -------------------------------------------------------------------------- */

/**
 * A table of contents is scanned, not read, and the icon column is the first
 * thing the eye lands on - so it has to be the thing that tells sections apart.
 * One book for every page and one stack for every section made the column a
 * ruled margin: eight identical marks above twenty-four identical marks.
 *
 * Every icon is declared once here and referenced from the tree below, so the
 * data stays a table of contents rather than a page of JSX.
 */
const gettingStartedIcon = <RocketIcon className="size-4" />;
const componentsIcon = <LayoutGridIcon className="size-4" />;
const primitivesIcon = <LayersIcon className="size-4" />;
const guidesIcon = <BookOpenIcon className="size-4" />;
const stylesIcon = <PaletteIcon className="size-4" />;
const integrationsIcon = <PuzzleIcon className="size-4" />;
const mcpIcon = <BotIcon className="size-4" />;
const changelogIcon = <TagIcon className="size-4" />;

/* -------------------------------------------------------------------------- */
/*                                 Page icons                                 */
/* -------------------------------------------------------------------------- */

const installIcon = <DownloadIcon className="size-4" />;
const themingIcon = <SlidersHorizontalIcon className="size-4" />;
const cliIcon = <TerminalIcon className="size-4" />;
const upgradeIcon = <RefreshCwIcon className="size-4" />;
const cascaderIcon = <ChevronsRightIcon className="size-4" />;
const dataGridIcon = <TableIcon className="size-4" />;
const kanbanIcon = <KanbanIcon className="size-4" />;
const ganttIcon = <ChartBarIcon className="size-4" />;
const calendarIcon = <CalendarDaysIcon className="size-4" />;
const frameIcon = <AppWindowIcon className="size-4" />;
const badgeIcon = <BadgeCheckIcon className="size-4" />;
const stepperIcon = <RouteIcon className="size-4" />;
const formsIcon = <ClipboardListIcon className="size-4" />;
const accessibilityIcon = <CircleUserRoundIcon className="size-4" />;
const darkModeIcon = <MoonIcon className="size-4" />;

/**
 * The four styles are the one run of pages with no natural iconography of their
 * own - they are named after constellations, so they get the sky rather than
 * four shades of the same swatch.
 */
const novaIcon = <SparklesIcon className="size-4" />;
const lyraIcon = <MusicIcon className="size-4" />;
const maiaIcon = <StarIcon className="size-4" />;
const seraIcon = <SunIcon className="size-4" />;
const nextIcon = <GlobeIcon className="size-4" />;
const viteIcon = <ZapIcon className="size-4" />;
const remixIcon = <GitMergeIcon className="size-4" />;
const setupIcon = <SettingsIcon className="size-4" />;
const toolsIcon = <WrenchIcon className="size-4" />;

const docs: CascaderNode[] = [
	{
		value: "getting-started",
		label: "Getting started",
		icon: gettingStartedIcon,
		children: [
			{ value: "gs.install", label: "Installation", icon: installIcon },
			{ value: "gs.theming", label: "Theming", icon: themingIcon },
			{ value: "gs.cli", label: "CLI", icon: cliIcon },
			{ value: "gs.upgrade", label: "Upgrading", icon: upgradeIcon },
		],
	},
	{
		value: "components",
		label: "Components",
		icon: componentsIcon,
		children: [
			{ value: "c.cascader", label: "Cascader", icon: cascaderIcon },
			{ value: "c.data-grid", label: "Data Grid", icon: dataGridIcon },
			{ value: "c.kanban", label: "Kanban", icon: kanbanIcon },
			{ value: "c.gantt", label: "Gantt", icon: ganttIcon },
			{ value: "c.calendar", label: "Event Calendar", icon: calendarIcon },
		],
	},
	{
		value: "primitives",
		label: "Primitives",
		icon: primitivesIcon,
		children: [
			{ value: "p.frame", label: "Frame", icon: frameIcon },
			{ value: "p.badge", label: "Badge", icon: badgeIcon },
			{ value: "p.stepper", label: "Stepper", icon: stepperIcon },
		],
	},
	{
		value: "guides",
		label: "Guides",
		icon: guidesIcon,
		children: [
			{ value: "g.forms", label: "Forms", icon: formsIcon },
			{ value: "g.a11y", label: "Accessibility", icon: accessibilityIcon },
			{ value: "g.dark-mode", label: "Dark mode", icon: darkModeIcon },
		],
	},
	{
		value: "styles",
		label: "Styles",
		icon: stylesIcon,
		children: [
			{ value: "s.nova", label: "Nova", icon: novaIcon },
			{ value: "s.lyra", label: "Lyra", icon: lyraIcon },
			{ value: "s.maia", label: "Maia", icon: maiaIcon },
			{ value: "s.sera", label: "Sera", icon: seraIcon },
		],
	},
	{
		value: "integrations",
		label: "Integrations",
		icon: integrationsIcon,
		children: [
			{ value: "i.next", label: "Next.js", icon: nextIcon },
			{ value: "i.vite", label: "Vite", icon: viteIcon },
			{ value: "i.remix", label: "Remix", icon: remixIcon },
		],
	},
	{
		value: "mcp",
		label: "MCP",
		icon: mcpIcon,
		children: [
			{ value: "m.setup", label: "Setup", icon: setupIcon },
			{ value: "m.tools", label: "Tools", icon: toolsIcon },
		],
	},
	{ value: "changelog", label: "Changelog", icon: changelogIcon },
];

/**
 * No trigger and no popover: `inline` drops the floating layer and
 * `CascaderPanel` renders the same nav, list and footer straight into the page.
 * Useful for sidebars, dialog bodies and settings screens, where a popover
 * inside a popover would be awkward.
 *
 * The surround is a shadcn `Card` rather than a hand-rolled `rounded-lg border`
 * div: radius is per style, and a literal is wrong in five of the eight.
 * `py-0` is the only override, so the panel sits flush inside it.
 *
 * The wrapper pins itself to the TOP of the preview surface (`self-start`,
 * plus `items-start` for the case where a host stretches it). Both the docs
 * frame and the catalog card centre their child vertically, and an embedded
 * panel changes height on every drill, so a centred demo slides up and down
 * under the reader's cursor. Anchored at the top it only grows downwards, and
 * `pt-6` keeps that top edge from sitting flush against the frame.
 */
export function Cascader7Example(): React.JSX.Element {
	const [value, setValue] = useState("");

	return (
		<div className="flex w-full items-start justify-center self-start px-4 pt-6 pb-4">
			<div className="flex w-full max-w-md flex-col gap-3">
				<Cascader inline items={docs} value={value} onValueChange={setValue}>
					<Card className="py-0">
						<CascaderPanel>
							<CascaderNav>
								<CascaderInput placeholder="Search documentation..." />
							</CascaderNav>
							<CascaderBreadcrumb />
							<CascaderEmpty />
							{/* Kept, and the ONE shape where it is not a shortcut: `inline` has no
                  positioner, so there is no `--available-height` to bound the
                  panel and the cap is the only thing that does. Every popover
                  example below drops it and lets the viewport decide. */}
							<CascaderList maxHeight={LIST_MAX_HEIGHT_PX}>
								<CascaderItems />
							</CascaderList>
							<CascaderStatus />
						</CascaderPanel>
					</Card>
				</Cascader>
			</div>
		</div>
	);
}
