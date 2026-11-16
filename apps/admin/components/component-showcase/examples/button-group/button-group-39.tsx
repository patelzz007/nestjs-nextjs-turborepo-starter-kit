"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

export function ButtonGroup39Example(): React.JSX.Element {
	return (
		<ButtonGroup className="**:data-[slot=button]:border-x-0">
			<Button variant="default">Save</Button>
			<ButtonGroupSeparator className="bg-primary-foreground/10" />
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="default" size="icon" aria-label="More options" />}>
					<ChevronDownIcon aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuItem>Save and publish</DropdownMenuItem>
					<DropdownMenuItem>Save as draft</DropdownMenuItem>
					<DropdownMenuItem>Save and exit</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
