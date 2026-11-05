// The drawer's menu pieces (ADR 038). Presentational — the caller supplies the
// person, the destinations, which one is on show and what each press does.
//
//   ╭──────────────────────────╮   DrawerAccountHeader: the one bold element,
//   │ (AM)  Alex Morgan        │   a solid `primary` card with the person
//   │       alex@example.com   │   (white in the dark themes, ink in light),
//   │──────────────────────────│   its action a full-width footer row under
//   │ ✎  Edit profile        › │   a hairline in the card's own colour.
//   ╰──────────────────────────╯
//   ╭──────────────────────────╮   DrawerSection + DrawerRow (ADR 079): each
//   │ [⌂] Home                 │   section is one rounded surface on the panel,
//   │ [⌕] Search               │   its title above it; each row's glyph sits on a
//   ╰──────────────────────────╯   small tile tinted in its section's tone, so the
//    Account                        sections read apart at a glance. The main
//   ╭──────────────────────────╮   section has no title and neutral tiles.
//   │ [▣] Security             │
//   ╰──────────────────────────╯
//
// Token utilities only, so it follows the light and dark themes.

import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import UserPenIcon from "lucide-react-native/icons/user-pen";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@workspace/ui-native/components/avatar";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";

export interface DrawerAccountHeaderAction {
	readonly label: string;
	readonly onPress: () => void;
}

export interface DrawerAccountHeaderProps {
	readonly name: string;
	readonly email: string;
	readonly imageUrl: string | null;
	readonly action: DrawerAccountHeaderAction;
	readonly testID?: string;
}

export function DrawerAccountHeader({ name, email, imageUrl, action, testID }: DrawerAccountHeaderProps): React.JSX.Element {
	return (
		<View className="overflow-hidden rounded-3xl bg-primary" testID={testID}>
			<View className="flex-row items-center gap-4 px-5 pt-5 pb-4">
				<View className="rounded-full border-2 border-primary-foreground/20 p-0.5">
					<Avatar name={name} imageUrl={imageUrl} tone="inverse" />
				</View>
				<View className="flex-1 gap-1">
					<Text numberOfLines={1} accessibilityRole="header" className="font-sans-bold text-xl tracking-tight text-primary-foreground">
						{name}
					</Text>
					<Text numberOfLines={1} className="font-sans text-sm text-primary-foreground/70">
						{email}
					</Text>
				</View>
			</View>
			<View className="mx-5 h-px bg-primary-foreground/15" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={action.label}
				onPress={action.onPress}
				className="min-h-13 flex-row items-center gap-3 px-5 py-3 active:bg-primary-foreground/10">
				<Icon icon={UserPenIcon} size="sm" colorClassName="accent-primary-foreground" />
				<Text className="flex-1 font-button text-sm text-primary-foreground">{action.label}</Text>
				<Icon icon={ChevronRightIcon} size="sm" colorClassName="accent-primary-foreground/60" />
			</Pressable>
		</View>
	);
}

/** The section dot's colours: the web sidebars' section tones (packages/ui panel-sidebar-section-header). */
export type DrawerSectionTone = "blue" | "green" | "amber" | "rose" | "purple" | "teal";

/** A row's glyph tile: the tone's soft fill and its glyph in the tone (`neutral`: the main section). */
type TileTone = DrawerSectionTone | "neutral" | "destructive";

const TILE_TONE_CLASSES: Readonly<Record<TileTone, { readonly tile: string; readonly icon: string }>> = {
	neutral: { tile: "bg-muted", icon: "accent-foreground" },
	blue: { tile: "bg-tone-blue-soft", icon: "accent-tone-blue" },
	green: { tile: "bg-tone-green-soft", icon: "accent-tone-green" },
	amber: { tile: "bg-tone-yellow-soft", icon: "accent-tone-yellow" },
	rose: { tile: "bg-tone-red-soft", icon: "accent-tone-red" },
	purple: { tile: "bg-tone-violet-soft", icon: "accent-tone-violet" },
	teal: { tile: "bg-tone-teal-soft", icon: "accent-tone-teal" },
	destructive: { tile: "bg-destructive-soft", icon: "accent-destructive-foreground" },
};

/** The tone of the section a row sits in: its rows' tiles take it. */
const SectionToneContext = React.createContext<TileTone>("neutral");

export interface DrawerSectionHeading {
	/** A short, sentence-case name ("Account"). */
	readonly title: string;
	/** The tint of its rows' glyph tiles. */
	readonly tone: DrawerSectionTone;
}

export interface DrawerSectionProps {
	/** The section's title and tone; the first, main section has none (neutral tiles, no title). */
	readonly heading?: DrawerSectionHeading;
	readonly children: React.ReactNode;
	readonly testID?: string;
}

export function DrawerSection({ heading, children, testID }: DrawerSectionProps): React.JSX.Element {
	return (
		<SectionToneContext.Provider value={heading?.tone ?? "neutral"}>
			<View className="gap-2 px-3" testID={testID}>
				{heading === undefined ? null : (
					<Text accessibilityRole="header" className="font-sans-semibold px-2 text-sm text-muted-foreground">
						{heading.title}
					</Text>
				)}
				<View className="gap-0.5 rounded-2xl border border-border bg-card p-1.5">{children}</View>
			</View>
		</SectionToneContext.Provider>
	);
}

export type DrawerRowTone = "default" | "destructive";

/** Label colours per tone — token utilities only. */
const ROW_LABEL_CLASSES: Readonly<Record<DrawerRowTone, string>> = {
	default: "font-sans-medium text-foreground",
	destructive: "font-sans-medium text-destructive-foreground",
};

/**
 * The screen on show: a solid `primary` capsule, inset in its section's surface, like the selected tab —
 * its glyph tile turns into a soft tint of the capsule's text colour.
 */
const SELECTED_CLASSES = {
	tile: "bg-primary-foreground/15",
	icon: "accent-primary-foreground",
	label: "font-sans-semibold text-primary-foreground",
	value: "text-primary-foreground/70",
};
const UNSELECTED_VALUE_CLASS = "text-muted-foreground";

export interface DrawerRowProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly onPress: () => void;
	/** The current setting, shown on the right ("System", "On"). */
	readonly value?: string;
	/** The screen on show: announced as selected and drawn as a solid capsule. */
	readonly selected?: boolean;
	readonly tone?: DrawerRowTone;
	/** A branch: whether its rows are shown (a chevron turns down when they are). Omitted for a screen. */
	readonly expanded?: boolean;
	readonly testID?: string;
}

export function DrawerRow({ icon, label, onPress, value, selected = false, tone = "default", expanded, testID }: DrawerRowProps): React.JSX.Element {
	const sectionTone = React.useContext(SectionToneContext);
	const tile = selected ? SELECTED_CLASSES : TILE_TONE_CLASSES[tone === "destructive" ? "destructive" : sectionTone];
	const labelClass = selected ? SELECTED_CLASSES.label : ROW_LABEL_CLASSES[tone];
	const valueClass = selected ? SELECTED_CLASSES.value : UNSELECTED_VALUE_CLASS;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={value === undefined ? label : `${label}, ${value}`}
			accessibilityState={expanded === undefined ? { selected } : { selected, expanded }}
			onPress={onPress}
			testID={testID}
			// Inset in its section's surface, so the capsule leaves a small gap on every side.
			className={`min-h-12 flex-row items-center gap-3 rounded-xl px-2.5 py-2 ${selected ? "bg-primary" : "active:bg-muted"}`}>
			<View
				className={`size-8 items-center justify-center rounded-lg ${tile.tile}`}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				testID={testID === undefined ? undefined : `${testID}-tile`}>
				<Icon icon={icon} size="sm" weight={selected ? "bold" : "regular"} colorClassName={tile.icon} />
			</View>
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
 * stepped in, with one vertical line down their left side, centred under the branch's glyph tile. Each
 * level is its own line a step further in, so lines never overlap; the line is the opaque `border` colour.
 */
export function DrawerSubmenu({ children, testID }: DrawerSubmenuProps): React.JSX.Element {
	return (
		<View className="ml-6.5 gap-0.5 border-l border-border pl-1.5" testID={testID}>
			{children}
		</View>
	);
}
