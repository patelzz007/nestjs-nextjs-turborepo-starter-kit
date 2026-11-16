import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { KbdGroup } from "@workspace/ui-native/components/kbd";
import * as React from "react";
import { Text, View } from "react-native";

const TITLE = "Keyboard shortcuts";

interface Shortcut {
	readonly action: string;
	readonly keys: readonly string[];
}

const SHORTCUTS: readonly Shortcut[] = [
	{ action: "Search", keys: ["⌘", "K"] },
	{ action: "New file", keys: ["⌘", "N"] },
	{ action: "Save", keys: ["⌘", "S"] },
	{ action: "Undo", keys: ["⌘", "Z"] },
	{ action: "Redo", keys: ["⌘", "⇧", "Z"] },
	{ action: "Bold", keys: ["⌘", "B"] },
	{ action: "Italic", keys: ["⌘", "I"] },
	{ action: "Toggle sidebar", keys: ["⌘", "\\"] },
];

function ShortcutRow({ shortcut }: { readonly shortcut: Shortcut }): React.JSX.Element {
	return (
		<View className="w-1/2 flex-row items-center justify-between gap-2 py-2 pr-3">
			<Text className="text-body flex-1 font-sans text-foreground">{shortcut.action}</Text>
			<KbdGroup keys={shortcut.keys} />
		</View>
	);
}

export function Dialog9Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	return (
		<>
			<Button label="Keyboard shortcuts" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen} size="lg" showCloseButton>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<View className="flex-row flex-wrap">
						{SHORTCUTS.map((shortcut: Shortcut): React.JSX.Element => (
							<ShortcutRow key={shortcut.action} shortcut={shortcut} />
						))}
					</View>
				</DialogBody>
			</Dialog>
		</>
	);
}
