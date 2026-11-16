import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

type DropdownMenuSide = NonNullable<React.ComponentProps<typeof DropdownMenuContent>["side"]>;

const sides: readonly DropdownMenuSide[] = ["inline-start", "left", "top", "bottom", "right", "inline-end"];

export function DropdownMenu2Example(): React.JSX.Element {
	return (
		<div className="grid grid-cols-3 gap-2">
			{sides.map((side: DropdownMenuSide): React.JSX.Element => (
				<DropdownMenu key={side}>
					<DropdownMenuTrigger render={<Button variant="outline" className="w-full" />}>
						{side.replace("-", " ").charAt(0).toUpperCase() + side.replace("-", " ").slice(1)}
					</DropdownMenuTrigger>
					<DropdownMenuContent side={side}>
						<DropdownMenuGroup>
							<DropdownMenuItem>Profile</DropdownMenuItem>
							<DropdownMenuItem>Billing</DropdownMenuItem>
							<DropdownMenuItem>Settings</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			))}
		</div>
	);
}
