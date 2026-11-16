import * as React from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@workspace/ui/components/context-menu";

const COPY_OPTIONS: readonly string[] = ["Copy", "Copy text", "Copy as plain text", "Copy as Markdown", "Copy as HTML", "Copy link", "Copy message ID", "Copy with sender"];

export function ContextMenuDont2Example(): React.JSX.Element {
	return (
		<ContextMenu>
			<ContextMenuTrigger className="flex h-20 w-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
				Right click a message
			</ContextMenuTrigger>
			<ContextMenuContent>
				{COPY_OPTIONS.map((option: string): React.JSX.Element => (
					<ContextMenuItem key={option}>{option}</ContextMenuItem>
				))}
			</ContextMenuContent>
		</ContextMenu>
	);
}
