import * as React from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@workspace/ui/components/context-menu";
import { Button } from "@workspace/ui/components/button";

export function ContextMenuDo1Example(): React.JSX.Element {
	return (
		<div className="flex flex-col items-center gap-2">
			<ContextMenu>
				<ContextMenuTrigger className="flex h-20 w-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
					quarterly-report.pdf — right click
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem>Download</ContextMenuItem>
					<ContextMenuItem>Delete</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
			<div className="flex gap-2">
				<Button variant="outline" size="sm">
					Download
				</Button>
				<Button variant="outline" size="sm">
					Delete
				</Button>
			</div>
		</div>
	);
}
