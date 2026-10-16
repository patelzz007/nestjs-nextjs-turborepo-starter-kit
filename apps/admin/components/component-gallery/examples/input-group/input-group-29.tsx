"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup29Example(): React.JSX.Element {
	const [category, setCategory] = useState("Category");

	// The menu items carry their option in `data-value`, so one handler serves them all.
	const handleSelect = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
		const { value } = event.currentTarget.dataset;
		if (value !== undefined) {
			setCategory(value);
		}
	}, []);

	return (
		<Field className="max-w-xs">
			<InputGroup className="rounded-full">
				<InputGroupInput placeholder="Search products" className="rounded-full px-5" />
				<InputGroupAddon align="inline-end">
					<DropdownMenu>
						<DropdownMenuTrigger render={<InputGroupButton variant="ghost" className="h-7 rounded-full px-3 text-xs" />}>
							{category}
							<ChevronDownIcon className="ml-1 size-3.5 opacity-60" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-32">
							<DropdownMenuItem data-value="Electronics" onClick={handleSelect}>
								Electronics
							</DropdownMenuItem>
							<DropdownMenuItem data-value="Clothing" onClick={handleSelect}>
								Clothing
							</DropdownMenuItem>
							<DropdownMenuItem data-value="Home" onClick={handleSelect}>
								Home
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
