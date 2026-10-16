import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Kbd } from "@workspace/ui/components/kbd";

interface Shortcut {
	readonly keys: readonly string[];
	readonly action: string;
}

interface ShortcutColumn {
	readonly id: string;
	readonly shortcuts: readonly Shortcut[];
}

const shortcuts: readonly Shortcut[] = [
	{ keys: ["⌘", "K"], action: "Search" },
	{ keys: ["⌘", "B"], action: "Bold" },
	{ keys: ["⌘", "I"], action: "Italic" },
	{ keys: ["⌘", "S"], action: "Save" },
	{ keys: ["⌘", "Z"], action: "Undo" },
	{ keys: ["⌘", "⇧", "Z"], action: "Redo" },
	{ keys: ["⌘", "N"], action: "New File" },
	{ keys: ["⌘", "P"], action: "Quick Open" },
	{ keys: ["⌘", "/"], action: "Toggle Comment" },
	{ keys: ["⌘", "D"], action: "Duplicate Line" },
];

/** The list splits into two columns, the first taking the odd one out. */
const COLUMN_COUNT = 2;
const FIRST_COLUMN_SIZE = Math.ceil(shortcuts.length / COLUMN_COUNT);
const COLUMNS: readonly ShortcutColumn[] = [
	{ id: "left", shortcuts: shortcuts.slice(0, FIRST_COLUMN_SIZE) },
	{ id: "right", shortcuts: shortcuts.slice(FIRST_COLUMN_SIZE) },
];

export function Dialog9Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Dialog>
				<DialogTrigger render={<Button variant="outline" />}>Keyboard Shortcuts</DialogTrigger>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Keyboard Shortcuts</DialogTitle>
						<DialogDescription>Quick reference for commonly used keyboard shortcuts.</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-x-6 gap-y-3">
						{COLUMNS.map((column: ShortcutColumn): React.JSX.Element => (
							<div key={column.id} className="space-y-3">
								{column.shortcuts.map((shortcut: Shortcut): React.JSX.Element => (
									<div key={shortcut.action} className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">{shortcut.action}</span>
										<div className="flex gap-1">
											{shortcut.keys.map((key: string): React.JSX.Element => (
												<Kbd key={key}>{key}</Kbd>
											))}
										</div>
									</div>
								))}
							</div>
						))}
					</div>
					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>Close</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
