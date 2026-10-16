"use client";

import * as React from "react";
import { LayersIcon, LockIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea } from "@workspace/ui/components/input-group";

export function InputGroup33Example(): React.JSX.Element {
	const [visibility, setVisibility] = useState("Personal");

	// The menu items carry their option in `data-value`, so one handler serves them all.
	const handleSelect = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
		const { value } = event.currentTarget.dataset;
		if (value !== undefined) {
			setVisibility(value);
		}
	}, []);

	return (
		<Field className="max-w-3xl">
			<InputGroup className="h-auto items-start bg-background p-3 pl-4">
				<InputGroupAddon className="mt-1.5 inline-flex size-8 items-center justify-center rounded-md border border-border bg-muted p-0">
					<LayersIcon className="size-4 text-muted-foreground" />
				</InputGroupAddon>

				<div className="flex flex-1 flex-col pt-2.5 pl-1">
					<InputGroupInput placeholder="Enter project name..." className="h-10 border-none text-base shadow-none focus-visible:ring-0" />
					<InputGroupTextarea
						placeholder="Description as multiple lines of text are supported..."
						className="min-h-16 border-none text-sm text-muted-foreground shadow-none focus-visible:ring-0"
					/>
				</div>

				<InputGroupAddon align="inline-end" className="gap-2 border-none">
					<InputGroupText className="text-sm whitespace-nowrap text-muted-foreground">Save to</InputGroupText>
					<DropdownMenu>
						<DropdownMenuTrigger render={<InputGroupButton variant="outline" size="sm" className="h-8 gap-2 font-normal" />}>
							<LockIcon className="size-3.5" />
							{visibility}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem data-value="Personal" onClick={handleSelect}>
								Personal
							</DropdownMenuItem>
							<DropdownMenuItem data-value="Team" onClick={handleSelect}>
								Team
							</DropdownMenuItem>
							<DropdownMenuItem data-value="Public" onClick={handleSelect}>
								Public
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<div className="mx-1 h-4 w-px self-center bg-border" />

					<InputGroupButton variant="secondary" size="sm">
						Cancel
					</InputGroupButton>
					<InputGroupButton variant="default" size="sm">
						Save
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
