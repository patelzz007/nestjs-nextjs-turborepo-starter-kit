// The app's command palette (ADR 079), opened from the page header's search button: the same places the
// drawer offers — its tabs, then its sections, filtered by the same capabilities and flags (one list,
// use-drawer-groups.ts), branches unfolded — each with its screen's subtitle under its name and its
// section's tone on its tile. UI only:
// typing narrows this list; it searches no data. Choosing a place goes there as the drawer does.

import * as React from "react";

import { CommandPalette, type CommandPaletteGroup, type CommandPaletteItem } from "@workspace/ui-native/components/command-palette";
import type { IconTileTone } from "@workspace/ui-native/components/icon-tile";
import type { DrawerSectionTone } from "../../components/drawer-menu";
import { useLabels } from "../language/use-app-language";
import { destinationsOf, drawerHeadingOf, type DrawerGroup, type DrawerScreen } from "./drawer-destinations";
import { NAVIGATION_LABELS, type NavigationLabels } from "./navigation-labels";
import { useDrawerGroups } from "./use-drawer-groups";
import { useOpenDestination } from "./use-open-destination";

/** A drawer section's tone as an icon tile's tint (the drawer's tiles use the same hues). */
const SECTION_TILE_TONES: Readonly<Record<DrawerSectionTone, IconTileTone>> = {
	blue: "blue",
	green: "green",
	amber: "yellow",
	rose: "red",
	purple: "violet",
	teal: "teal",
};

/** The palette's groups: "Go to" (the tabs, neutral tiles), then the drawer's sections in their tones. */
export function commandGroupsOf(labels: NavigationLabels, groups: readonly DrawerGroup[], open: (screen: DrawerScreen) => void): CommandPaletteGroup[] {
	const itemOf =
		(tone: IconTileTone) =>
		(screen: DrawerScreen): CommandPaletteItem => {
			const heading = drawerHeadingOf(screen, labels);
			return {
				key: screen.id,
				label: heading.title,
				...(heading.subtitle === "" ? {} : { description: heading.subtitle }),
				icon: screen.icon,
				tone,
				onSelect: (): void => {
					open(screen);
				},
				testID: `command-${screen.labelKey}`,
			};
		};
	return groups.map((group: DrawerGroup): CommandPaletteGroup =>
		group.heading === null
			? { key: group.key, title: labels.commandPalette.goTo, items: destinationsOf(group.nodes).map(itemOf("neutral")) }
			: { key: group.key, title: labels.sections[group.heading.section], items: destinationsOf(group.nodes).map(itemOf(SECTION_TILE_TONES[group.heading.tone])) },
	);
}

export interface AppCommandPaletteProps {
	readonly visible: boolean;
	readonly onClose: () => void;
}

export function AppCommandPalette({ visible, onClose }: AppCommandPaletteProps): React.JSX.Element {
	const labels = useLabels(NAVIGATION_LABELS);
	const drawerGroups = useDrawerGroups();
	const openDestination = useOpenDestination();
	const open = React.useCallback(
		(screen: DrawerScreen): void => {
			openDestination(screen.route, screen.isTab);
		},
		[openDestination],
	);
	const groups = commandGroupsOf(labels, drawerGroups, open);
	return (
		<CommandPalette
			visible={visible}
			onClose={onClose}
			groups={groups}
			title={labels.commandPalette.title}
			placeholder={labels.commandPalette.placeholder}
			emptyMessage={labels.commandPalette.empty}
			testID="command-palette"
		/>
	);
}
