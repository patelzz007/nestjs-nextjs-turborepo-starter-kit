import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { MoreHorizontalIcon } from "lucide-react";

export function DropdownMenuDo2Example(): React.JSX.Element {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Record actions" />}>
				<MoreHorizontalIcon aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>Edit</DropdownMenuItem>
				<DropdownMenuItem>Duplicate</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
