import * as React from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@workspace/ui/components/context-menu";

export function ContextMenuDont1Example(): React.JSX.Element {
	return (
		<ContextMenu>
			<ContextMenuTrigger className="flex h-20 w-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
				quarterly-report.pdf
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem>Delete</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
