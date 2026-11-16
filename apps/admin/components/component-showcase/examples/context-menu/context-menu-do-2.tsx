import * as React from "react";
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@workspace/ui/components/context-menu";

export function ContextMenuDo2Example(): React.JSX.Element {
	return (
		<ContextMenu>
			<ContextMenuTrigger className="flex h-20 w-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
				Right click a message
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuGroup>
					<ContextMenuItem>Reply</ContextMenuItem>
					<ContextMenuItem>Copy text</ContextMenuItem>
				</ContextMenuGroup>
				<ContextMenuSeparator />
				<ContextMenuGroup>
					<ContextMenuItem>Delete</ContextMenuItem>
				</ContextMenuGroup>
			</ContextMenuContent>
		</ContextMenu>
	);
}
