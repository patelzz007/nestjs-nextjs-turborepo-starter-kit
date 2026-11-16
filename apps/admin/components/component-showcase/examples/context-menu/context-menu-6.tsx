import * as React from "react";
import { ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuGroup, ContextMenuTrigger } from "@workspace/ui/components/context-menu";

export function ContextMenu6Example(): React.JSX.Element {
	return (
		<div className="flex w-full items-center justify-center p-12">
			<ContextMenu>
				<ContextMenuTrigger className="flex aspect-[2/0.5] w-full max-w-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
					Right click here
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuGroup>
						<ContextMenuCheckboxItem defaultChecked>Show Bookmarks Bar</ContextMenuCheckboxItem>
						<ContextMenuCheckboxItem>Show Full URLs</ContextMenuCheckboxItem>
						<ContextMenuCheckboxItem defaultChecked>Show Developer Tools</ContextMenuCheckboxItem>
					</ContextMenuGroup>
				</ContextMenuContent>
			</ContextMenu>
		</div>
	);
}
