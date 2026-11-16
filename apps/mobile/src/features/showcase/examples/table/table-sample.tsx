// What the Table examples share: the web examples' portraits and a person cell (an avatar, a name and a second line).

import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Text, View } from "react-native";

const PORTRAIT = "?w=96&h=96&dpr=2&q=80";

/** Portraits by person (images.unsplash.com), the same as the web examples'. */
export const PORTRAITS: Readonly<Record<string, string>> = {
	"Sarah Chen": `https://images.unsplash.com/photo-1494790108377-be9c29b29330${PORTRAIT}`,
	"Marcus Johnson": `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde${PORTRAIT}`,
	"Emily Park": `https://images.unsplash.com/photo-1438761681033-6461ffad8d80${PORTRAIT}`,
	"David Kim": `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e${PORTRAIT}`,
	"Sofia Davis": `https://images.unsplash.com/photo-1519699047748-de8e457a634e${PORTRAIT}`,
};

/** A person in a cell: their avatar, name and a second line (an email, a handle). */
export function PersonCell({ name, line }: { readonly name: string; readonly line: string }): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<Avatar name={name} imageUrl={PORTRAITS[name] ?? null} size="sm" />
			<View className="shrink">
				<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
					{name}
				</Text>
				<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
					{line}
				</Text>
			</View>
		</View>
	);
}

/** One label and value row of a vertical table: the label on a shaded column. */
export function DetailRow({ label, children, last = false }: { readonly label: string; readonly children: React.ReactNode; readonly last?: boolean }): React.JSX.Element {
	return (
		<View accessible className={last ? "flex-row" : "flex-row border-b border-border"}>
			<View className="w-32 justify-center bg-muted/50 px-3 py-2">
				<Text className="text-label font-sans-medium text-foreground">{label}</Text>
			</View>
			<View className="flex-1 justify-center px-3 py-2">{children}</View>
		</View>
	);
}
