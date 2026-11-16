import * as React from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";

export function ContextMenu4Example(): React.JSX.Element {
	return (
		<div className="flex w-full items-center justify-center p-12">
			<ContextMenu>
				<ContextMenuTrigger className="flex aspect-[2/0.5] w-full max-w-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
					Right click here
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuGroup>
						<ContextMenuItem>
							Copy
							<ContextMenuShortcut>⌘C</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem>
							Cut
							<ContextMenuShortcut>⌘X</ContextMenuShortcut>
						</ContextMenuItem>
					</ContextMenuGroup>
					<ContextMenuSub>
						<ContextMenuSubTrigger>More Tools</ContextMenuSubTrigger>
						<ContextMenuSubContent>
							<ContextMenuGroup>
								<ContextMenuItem>Save Page...</ContextMenuItem>
								<ContextMenuItem>Create Shortcut...</ContextMenuItem>
								<ContextMenuItem>Name Window...</ContextMenuItem>
							</ContextMenuGroup>
							<ContextMenuSeparator />
							<ContextMenuGroup>
								<ContextMenuItem>Developer Tools</ContextMenuItem>
							</ContextMenuGroup>
							<ContextMenuSeparator />
							<ContextMenuGroup>
								<ContextMenuItem variant="destructive">Delete</ContextMenuItem>
							</ContextMenuGroup>
						</ContextMenuSubContent>
					</ContextMenuSub>
				</ContextMenuContent>
			</ContextMenu>
		</div>
	);
}
