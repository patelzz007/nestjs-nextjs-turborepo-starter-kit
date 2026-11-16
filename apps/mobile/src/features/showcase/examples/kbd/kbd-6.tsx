import { KbdGroup } from "@workspace/ui-native/components/kbd";
import * as React from "react";
import { Text, View } from "react-native";

interface Shortcut {
	readonly command: string;
	readonly keys: readonly string[];
	readonly spoken: string;
}

const SHORTCUTS: readonly Shortcut[] = [
	{ command: "Search", keys: ["⌘", "K"], spoken: "Command K" },
	{ command: "New file", keys: ["⌘", "N"], spoken: "Command N" },
	{ command: "Save", keys: ["⌘", "S"], spoken: "Command S" },
	{ command: "Undo", keys: ["⌘", "Z"], spoken: "Command Z" },
	{ command: "Redo", keys: ["⌘", "⇧", "Z"], spoken: "Command Shift Z" },
];

export function Kbd6Example(): React.JSX.Element {
	return (
		<View className="gap-1">
			<Text accessibilityRole="header" className="text-label font-sans-semibold text-foreground">
				Keyboard shortcuts
			</Text>
			{SHORTCUTS.map(({ command, keys, spoken }: Shortcut): React.JSX.Element => (
				<View key={command} className="min-h-11 flex-row items-center justify-between border-b border-border">
					<Text className="text-body font-sans text-foreground">{command}</Text>
					<KbdGroup keys={keys} accessibilityLabel={spoken} />
				</View>
			))}
		</View>
	);
}
