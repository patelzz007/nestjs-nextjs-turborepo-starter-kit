"use client";

import * as React from "react";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

export function DropdownMenu7Example(): React.JSX.Element {
	const [position, setPosition] = useState("bottom");

	return (
		<div className="flex items-center justify-center">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" className="w-fit" />}>Radio Group</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuGroup>
						<DropdownMenuLabel>Panel Position</DropdownMenuLabel>
						<DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
							<DropdownMenuRadioItem value="top">
								<ArrowUpIcon />
								Top
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="bottom">
								<ArrowDownIcon />
								Bottom
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="right" disabled>
								<ArrowRightIcon />
								Right
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
