// The drawer's menu pieces (ADR 038). Presentational — the caller supplies the
// person, the destinations, which one is on show and what each press does.
//
//   ╭──────────────────────────╮   DrawerAccountHeader: the one bold element,
//   │ (AM)  Alex Morgan        │   a solid `primary` block with the person.
//   │       alex@example.com   │
//   │       [ Edit profile ]   │
//   ╰──────────────────────────╯
//    ⌂   Home                      DrawerSection + DrawerRow: a plain list.
//    ⌕   Search                    Each titled section opens with a full-width
//   ──────────────────────────     divider and a tone dot before its title, as
//    • Account                     the web sidebars' section headers do.
//    ▣   Security
//
// Token utilities only, so it follows the light and dark themes.

import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "./avatar";
import { Icon, type LucideIcon } from "./icon";

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
		<View className="gap-4 rounded-3xl bg-primary p-5" testID={testID}>
			<View className="flex-row items-center gap-3.5">
				<View className="rounded-full border-2 border-primary-foreground/25 p-0.5">
					<Avatar name={name} imageUrl={imageUrl} tone="inverse" />
				</View>
				<View className="flex-1 gap-0.5">
					<Text numberOfLines={1} accessibilityRole="header" className="font-heading text-xl text-primary-foreground">
						{name}
					</Text>
					<Text numberOfLines={1} className="font-sans text-sm text-primary-foreground/70">
						{email}
					</Text>
				</View>
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={action.label}
				onPress={action.onPress}
				className="min-h-11 items-center justify-center self-start rounded-full bg-primary-foreground/15 px-4 active:opacity-70">
				<Text className="font-sans-semibold text-sm text-primary-foreground">{action.label}</Text>
			</Pressable>
		</View>
	);
}

/** The section dot's colours: the web sidebars' section tones (packages/ui panel-sidebar-section-header). */
export type DrawerSectionTone = "blue" | "green" | "amber" | "rose" | "purple" | "teal";

const SECTION_TONE_CLASSES: Readonly<Record<DrawerSectionTone, string>> = {
	blue: "bg-tone-blue",
	green: "bg-tone-green",
	amber: "bg-tone-yellow",
	rose: "bg-tone-red",
	purple: "bg-tone-violet",
	teal: "bg-tone-teal",
};

export interface DrawerSectionHeading {
	/** A short, sentence-case name ("Account"). */
	readonly title: string;
	/** The dot before the title. */
	readonly tone: DrawerSectionTone;
}

export interface DrawerSectionProps {
	/** The section's title and dot; the first, main section has none and no divider above it. */
	readonly heading?: DrawerSectionHeading;
	readonly children: React.ReactNode;
	readonly testID?: string;
}

export function DrawerSection({ heading, children, testID }: DrawerSectionProps): React.JSX.Element {
	return (
		<View className={heading === undefined ? "" : "border-t border-border pt-3"} testID={testID}>
			{heading === undefined ? null : (
				<View className="flex-row items-center gap-2 px-6 pb-1">
					<View className={`size-1.5 rounded-full ${SECTION_TONE_CLASSES[heading.tone]}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
					<Text accessibilityRole="header" className="font-sans-semibold text-sm text-muted-foreground">
						{heading.title}
					</Text>
				</View>
			)}
			{children}
		</View>
	);
}

export type DrawerRowTone = "default" | "destructive";

/** Icon and label colours per tone and state — token utilities only. */
const ROW_TONE_CLASSES: Readonly<Record<DrawerRowTone, { readonly icon: string; readonly label: string }>> = {
	default: { icon: "accent-muted-foreground", label: "font-sans-medium text-foreground" },
	destructive: { icon: "accent-destructive-foreground", label: "font-sans-medium text-destructive-foreground" },
};

/**
 * The screen on show: a solid `primary` capsule — slate on white in light mode, white on slate in
 * dark — like the web sidebars' active row and the selected tab.
 */
const SELECTED_CLASSES = { icon: "accent-primary-foreground", label: "font-sans-semibold text-primary-foreground", value: "text-primary-foreground/70" };
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
	readonly testID?: string;
}

export function DrawerRow({ icon, label, onPress, value, selected = false, tone = "default", testID }: DrawerRowProps): React.JSX.Element {
	const classes = selected ? SELECTED_CLASSES : ROW_TONE_CLASSES[tone];
	const valueClass = selected ? SELECTED_CLASSES.value : UNSELECTED_VALUE_CLASS;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={value === undefined ? label : `${label}, ${value}`}
			accessibilityState={{ selected }}
			onPress={onPress}
			testID={testID}
			// Inset from the panel's edges, so the capsule leaves a small gap on both sides.
			className={`mx-3 min-h-12 flex-row items-center gap-3.5 rounded-xl px-3 py-2.5 ${selected ? "bg-primary" : "active:bg-muted"}`}>
			<Icon icon={icon} size="md" weight={selected ? "bold" : "regular"} colorClassName={classes.icon} />
			<Text numberOfLines={1} className={`flex-1 text-base ${classes.label}`}>
				{label}
			</Text>
			{value === undefined ? null : <Text className={`font-sans text-sm ${valueClass}`}>{value}</Text>}
		</Pressable>
	);
}
