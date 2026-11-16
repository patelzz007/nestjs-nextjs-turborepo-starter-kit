"use client";

import * as React from "react";
import { AtSignIcon, ChevronDownIcon, CornerDownLeftIcon, FileTextIcon, ImageIcon, PaperclipIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@workspace/ui/components/input-group";

export function InputGroup19Example(): React.JSX.Element {
	const [model, setModel] = useState("GPT-4o");

	// The menu items carry their option in `data-value`, so one handler serves them all.
	const handleSelect = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
		const { value } = event.currentTarget.dataset;
		if (value !== undefined) {
			setModel(value);
		}
	}, []);

	return (
		<Field className="max-w-xs">
			<InputGroup className="bg-background">
				<InputGroupAddon align="block-start" className="gap-2 px-3 pt-3">
					<InputGroupButton variant="outline" size="icon-xs">
						<AtSignIcon className="size-3.5" />
					</InputGroupButton>
					<InputGroupButton variant="outline">
						<PaperclipIcon className="size-3.5 not-only:rotate-45" />1
					</InputGroupButton>
					<InputGroupButton variant="outline">
						<FileTextIcon className="size-3.5 not-only:rotate-45" />1 Tab
					</InputGroupButton>
				</InputGroupAddon>

				<InputGroupTextarea placeholder="Plan, search, build anything" className="min-h-24 border-none py-4 shadow-none focus-visible:ring-0" />

				<InputGroupAddon align="block-end" className="px-3 pb-3">
					<DropdownMenu>
						<DropdownMenuTrigger render={<InputGroupButton variant="secondary" size="sm" />}>
							{model}
							<ChevronDownIcon />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem data-value="GPT-4o" onClick={handleSelect}>
								GPT-4o
							</DropdownMenuItem>
							<DropdownMenuItem data-value="Claude 3.5 Sonnet" onClick={handleSelect}>
								Claude 3.5 Sonnet
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<div className="ml-auto flex items-center gap-2">
						<InputGroupButton variant="secondary" size="icon-sm">
							<ImageIcon className="text-muted-foreground" />
						</InputGroupButton>
						<InputGroupButton variant="default" size="icon-sm">
							<CornerDownLeftIcon />
						</InputGroupButton>
					</div>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
