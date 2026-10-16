import * as React from "react";
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from "@workspace/ui/components/context-menu";

type ContextMenuSide = NonNullable<React.ComponentProps<typeof ContextMenuContent>["side"]>;

const SIDES: readonly ContextMenuSide[] = ["inline-start", "left", "top", "bottom", "right", "inline-end"];

export function ContextMenu9Example(): React.JSX.Element {
	return (
		<div className="flex w-full items-center justify-center p-12">
			<div className="flex flex-wrap justify-center gap-2">
				{SIDES.map((side: ContextMenuSide): React.JSX.Element => (
					<ContextMenu key={side}>
						<ContextMenuTrigger className="flex aspect-[2/0.5] items-center justify-center rounded-lg border border-dashed p-4 text-sm text-muted-foreground capitalize">
							{side.replace("-", " ")}
						</ContextMenuTrigger>
						<ContextMenuContent side={side}>
							<ContextMenuGroup>
								<ContextMenuItem>Back</ContextMenuItem>
								<ContextMenuItem>Forward</ContextMenuItem>
								<ContextMenuItem>Reload</ContextMenuItem>
							</ContextMenuGroup>
						</ContextMenuContent>
					</ContextMenu>
				))}
			</div>
		</div>
	);
}
