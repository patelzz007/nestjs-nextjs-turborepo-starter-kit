// The drawer's menu pieces (ADR 038). Presentational — the caller supplies the person, the destinations,
// which one is on show and what each press does; features/navigation/drawer-layouts.ts says how they combine.
//
//   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   DrawerWash: a soft glow behind the person (the `wash` looks).
//         (AM)                     DrawerProfile: the person, in a row, stacked, or centred; on the
//      Alex Morgan                 sign-in panel's ink, or on the page's colours.
//    alex@example.com
//   ╭──────────────────────────╮
//    (⌂ Home                 )     DrawerRow: a bare glyph and label; the screen on show is a capsule,
//     ⌕ Search                     solid or soft (DrawerSelectionContext).
//    Account                       DrawerSection: an optional small title over its rows.
//     ▣ Security
//
// Token utilities only, so it follows the light, dark and Nord themes.

import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Avatar } from "@workspace/ui-native/components/avatar";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";

export type DrawerProfileLayout = "row" | "stacked" | "centred";

/** What shows the person can be pressed. */
export type DrawerAction = "chevron" | "link" | "none";

const PROFILE_LAYOUT_CLASSES: Readonly<Record<DrawerProfileLayout, { readonly root: string; readonly ring: string; readonly name: string; readonly text: string }>> = {
	row: { root: "flex-row items-center gap-3 px-5 pt-4 pb-5", ring: "", name: "text-lg", text: "flex-1 gap-0.5" },
	stacked: { root: "gap-3 px-6 pt-4 pb-5", ring: "self-start", name: "text-2xl", text: "gap-0.5" },
	centred: { root: "items-center gap-3 px-5 pt-3 pb-6", ring: "", name: "text-xl", text: "items-center gap-0.5" },
};

/** The person's colours: white on the ink panel, the page's own ink anywhere else. */
const PROFILE_TONE_CLASSES = {
	ink: { name: "text-auth-panel-foreground", muted: "text-auth-panel-muted", glyph: "accent-auth-panel-muted", ring: "border-auth-panel-foreground/20" },
	page: { name: "text-foreground", muted: "text-muted-foreground", glyph: "accent-muted-foreground", ring: "border-border" },
};

export interface DrawerProfileProps {
	readonly name: string;
	readonly email: string;
	readonly imageUrl: string | null;
	/** Pressing the person: its name, and what happens. */
	readonly actionLabel: string;
	readonly onPress: () => void;
	readonly layout: DrawerProfileLayout;
	readonly action: DrawerAction;
	/** On the ink panel rather than the page's colours. */
	readonly onInk: boolean;
	/** A line under the email (the status line). */
	readonly detail?: React.ReactNode;
	readonly testID?: string;
}

export function DrawerProfile({ name, email, imageUrl, actionLabel, onPress, layout, action, onInk, detail, testID }: DrawerProfileProps): React.JSX.Element {
	const shape = PROFILE_LAYOUT_CLASSES[layout];
	const tone = onInk ? PROFILE_TONE_CLASSES.ink : PROFILE_TONE_CLASSES.page;
	return (
		<View testID={testID}>
			<Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${actionLabel}`} onPress={onPress} className={`active:opacity-80 ${shape.root}`}>
				<View className={`rounded-full border-2 p-0.5 ${shape.ring} ${tone.ring}`}>
					<Avatar name={name} imageUrl={imageUrl} tone={onInk ? "panel" : "solid"} />
				</View>
				<View className={shape.text}>
					<Text numberOfLines={1} accessibilityRole="header" className={`font-sans-bold tracking-tight ${shape.name} ${tone.name}`}>
						{name}
					</Text>
					<Text numberOfLines={1} className={`font-sans text-sm ${tone.muted}`}>
						{email}
					</Text>
					{action === "link" ? <Text className="font-sans-semibold mt-1 text-sm text-link">{actionLabel}</Text> : null}
					{detail === undefined ? null : <View className="mt-1">{detail}</View>}
				</View>
				{action === "chevron" ? <Icon icon={ChevronRightIcon} size="sm" colorClassName={tone.glyph} /> : null}
			</Pressable>
		</View>
	);
}

const WASH_GRADIENT_ID = "drawer-wash";
const WASH_TOP = "0";
const WASH_BOTTOM = "1";
const WASH_TOP_OPACITY = 1;
const WASH_BOTTOM_OPACITY = 0;

/** The `wash` looks' glow: the page's soft grey fading to nothing, behind the person. Decorative. */
export function DrawerWash(): React.JSX.Element {
	const color = String(useCSSVariable("--muted"));
	return (
		<View pointerEvents="none" className="absolute inset-x-0 top-0 h-72" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="drawer-wash">
			<Svg width="100%" height="100%">
				<Defs>
					<LinearGradient id={WASH_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
						<Stop offset={WASH_TOP} stopColor={color} stopOpacity={WASH_TOP_OPACITY} />
						<Stop offset={WASH_BOTTOM} stopColor={color} stopOpacity={WASH_BOTTOM_OPACITY} />
					</LinearGradient>
				</Defs>
				<Rect width="100%" height="100%" fill={`url(#${WASH_GRADIENT_ID})`} />
			</Svg>
		</View>
	);
}

/** The section dot's colours: the web sidebars' section tones (packages/ui panel-sidebar-section-header). */
export type DrawerSectionTone = "blue" | "green" | "amber" | "rose" | "purple" | "teal";

export interface DrawerSectionProps {
	/** A short, sentence-case name ("Account"); the first, main section has none. */
	readonly title?: string;
	readonly children: React.ReactNode;
	readonly testID?: string;
}

export function DrawerSection({ title, children, testID }: DrawerSectionProps): React.JSX.Element {
	return (
		<View className="gap-0.5 px-2.5" testID={testID}>
			{title === undefined ? null : (
				<Text accessibilityRole="header" className="font-sans-semibold px-3.5 pt-1 pb-1 text-sm text-muted-foreground">
					{title}
				</Text>
			)}
			{children}
		</View>
	);
}

/** The line between two sections, so they read apart at a glance. Decorative: the section titles say the same to a screen reader. */
export function DrawerDivider(): React.JSX.Element {
	return <View className="mx-6 my-2 h-px bg-border" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="drawer-divider" />;
}

/** How the screen on show is drawn. */
export type DrawerSelection = "solid" | "soft";

/** The look's choice of capsule: the rows read it, so a look is set once around them. */
export const DrawerSelectionContext = React.createContext<DrawerSelection>("solid");

const SELECTED_CLASSES: Readonly<Record<DrawerSelection, { readonly row: string; readonly icon: string; readonly label: string; readonly value: string }>> = {
	solid: { row: "bg-primary", icon: "accent-primary-foreground", label: "font-sans-semibold text-primary-foreground", value: "text-primary-foreground/70" },
	soft: {
		row: "bg-muted light:bg-primary",
		icon: "accent-foreground light:accent-primary-foreground",
		label: "font-sans-semibold text-foreground light:text-primary-foreground",
		value: "text-muted-foreground light:text-primary-foreground/70",
	},
};

export type DrawerRowTone = "default" | "destructive";

/** An unselected row's colours per tone — token utilities only. */
const ROW_CLASSES: Readonly<Record<DrawerRowTone, { readonly icon: string; readonly label: string }>> = {
	default: { icon: "accent-muted-foreground", label: "font-sans-medium text-foreground" },
	destructive: { icon: "accent-destructive-foreground", label: "font-sans-medium text-destructive-foreground" },
};

export interface DrawerRowProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly onPress: () => void;
	/** The current setting, shown on the right ("System", "On"). */
	readonly value?: string;
	/** The screen on show: announced as selected and drawn as a capsule. */
	readonly selected?: boolean;
	readonly tone?: DrawerRowTone;
	/** A branch: whether its rows are shown (a chevron turns down when they are). Omitted for a screen. */
	readonly expanded?: boolean;
	readonly testID?: string;
}

export function DrawerRow({ icon, label, onPress, value, selected = false, tone = "default", expanded, testID }: DrawerRowProps): React.JSX.Element {
	const capsule = SELECTED_CLASSES[React.useContext(DrawerSelectionContext)];
	const iconClass = selected ? capsule.icon : ROW_CLASSES[tone].icon;
	const labelClass = selected ? capsule.label : ROW_CLASSES[tone].label;
	const valueClass = selected ? capsule.value : "text-muted-foreground";
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={value === undefined ? label : `${label}, ${value}`}
			accessibilityState={expanded === undefined ? { selected } : { selected, expanded }}
			onPress={onPress}
			testID={testID}
			className={`min-h-12 flex-row items-center gap-3.5 rounded-full px-3.5 py-2 ${selected ? capsule.row : "active:bg-muted"}`}>
			<Icon icon={icon} size="sm" weight={selected ? "bold" : "regular"} colorClassName={iconClass} />
			<Text numberOfLines={1} className={`flex-1 text-base ${labelClass}`}>
				{label}
			</Text>
			{value === undefined ? null : <Text className={`font-sans text-sm ${valueClass}`}>{value}</Text>}
			{expanded === undefined ? null : (
				<Icon
					icon={expanded ? ChevronDownIcon : ChevronRightIcon}
					size="sm"
					colorClassName="accent-muted-foreground"
					{...(testID === undefined ? {} : { testID: `${testID}-chevron` })}
				/>
			)}
		</Pressable>
	);
}

export interface DrawerSubmenuProps {
	/** The branch's rows (and any branch under it, which nests its own submenu one step further in). */
	readonly children: React.ReactNode;
	readonly testID?: string;
}

/**
 * The rows under an open branch, like the web sidebars' nested lists (packages/ui panel-sidebar-nav-item):
 * stepped in, with one vertical line down their left side, centred under the branch's glyph. Each level is
 * its own line a step further in, so lines never overlap; the line is the opaque `border` colour.
 */
export function DrawerSubmenu({ children, testID }: DrawerSubmenuProps): React.JSX.Element {
	return (
		<View className="ml-6 gap-0.5 border-l border-border pl-1.5" testID={testID}>
			{children}
		</View>
	);
}
