import * as React from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";

export function ContextMenu3Example(): React.JSX.Element {
	return (
		<div className="flex w-full items-center justify-center p-12">
			<ContextMenu>
				<ContextMenuTrigger className="flex aspect-[2/0.5] w-full max-w-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
					Right click here
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuGroup>
						<ContextMenuItem>
							Back
							<ContextMenuShortcut>⌘[</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem disabled>
							Forward
							<ContextMenuShortcut>⌘]</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem>
							Reload
							<ContextMenuShortcut>⌘R</ContextMenuShortcut>
						</ContextMenuItem>
					</ContextMenuGroup>
					<ContextMenuSeparator />
					<ContextMenuGroup>
						<ContextMenuItem>
							Save
							<ContextMenuShortcut>⌘S</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem>
							Save As...
							<ContextMenuShortcut>⇧⌘S</ContextMenuShortcut>
						</ContextMenuItem>
					</ContextMenuGroup>
				</ContextMenuContent>
			</ContextMenu>
		</div>
	);
}
