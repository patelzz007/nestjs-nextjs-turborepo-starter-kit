"use client";

import * as React from "react";
import { ActivityIcon, LayoutIcon, PanelLeftIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

export function DropdownMenu6Example(): React.JSX.Element {
	const [showStatusBar, setShowStatusBar] = useState(true);
	const [showActivityBar, setShowActivityBar] = useState(false);
	const [showPanel, setShowPanel] = useState(false);

	return (
		<div className="flex items-center justify-center">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" className="w-fit" />}>Checkboxes</DropdownMenuTrigger>
				<DropdownMenuContent className="min-w-40">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Appearance</DropdownMenuLabel>
						<DropdownMenuCheckboxItem checked={showStatusBar} onCheckedChange={setShowStatusBar}>
							<LayoutIcon />
							Status Bar
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem checked={showActivityBar} onCheckedChange={setShowActivityBar} disabled>
							<ActivityIcon />
							Activity Bar
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem checked={showPanel} onCheckedChange={setShowPanel}>
							<PanelLeftIcon />
							Panel
						</DropdownMenuCheckboxItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
