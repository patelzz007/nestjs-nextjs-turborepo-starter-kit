"use client";

import * as React from "react";
import { useState } from "react";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuLabel,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";

export function ContextMenu7Example(): React.JSX.Element {
	const [user, setUser] = useState("pedro");
	const [theme, setTheme] = useState("light");

	return (
		<div className="flex w-full items-center justify-center p-12">
			<ContextMenu>
				<ContextMenuTrigger className="flex aspect-[2/0.5] w-full max-w-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
					Right click here
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuGroup>
						<ContextMenuLabel>People</ContextMenuLabel>
						<ContextMenuRadioGroup value={user} onValueChange={setUser}>
							<ContextMenuRadioItem value="pedro">Pedro Duarte</ContextMenuRadioItem>
							<ContextMenuRadioItem value="colm">Colm Tuite</ContextMenuRadioItem>
						</ContextMenuRadioGroup>
					</ContextMenuGroup>
					<ContextMenuSeparator />
					<ContextMenuGroup>
						<ContextMenuLabel>Theme</ContextMenuLabel>
						<ContextMenuRadioGroup value={theme} onValueChange={setTheme}>
							<ContextMenuRadioItem value="light">Light</ContextMenuRadioItem>
							<ContextMenuRadioItem value="dark">Dark</ContextMenuRadioItem>
							<ContextMenuRadioItem value="system">System</ContextMenuRadioItem>
						</ContextMenuRadioGroup>
					</ContextMenuGroup>
				</ContextMenuContent>
			</ContextMenu>
		</div>
	);
}
