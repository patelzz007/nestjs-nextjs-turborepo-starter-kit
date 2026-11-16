"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

const ROLES: readonly string[] = ["Admin", "Member", "Viewer"];

export function InputGroup32Example(): React.JSX.Element {
	const [role, setRole] = useState("Admin");

	// Each menu item carries its role in `data-value`, so one handler serves them all.
	const handleSelect = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
		const { value } = event.currentTarget.dataset;
		if (value !== undefined) {
			setRole(value);
		}
	}, []);

	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupAddon className="pr-1">
					<Avatar className="size-5">
						<AvatarFallback>SC</AvatarFallback>
					</Avatar>
				</InputGroupAddon>

				<InputGroupInput defaultValue="@shadcn" className="pl-1!" />

				<InputGroupAddon align="inline-end">
					<DropdownMenu>
						<DropdownMenuTrigger render={<InputGroupButton variant="ghost" className="h-7 text-xs" />}>
							{role}
							<ChevronDownIcon className="size-3.5 opacity-60" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-32">
							{ROLES.map((option) => (
								<DropdownMenuItem key={option} data-value={option} onClick={handleSelect}>
									{option}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
