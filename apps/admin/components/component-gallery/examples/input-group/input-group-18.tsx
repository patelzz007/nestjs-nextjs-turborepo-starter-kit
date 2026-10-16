"use client";

import * as React from "react";
import { ArrowUpIcon, ChevronDownIcon, GlobeIcon, MicIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@workspace/ui/components/input-group";
import { Kbd } from "@workspace/ui/components/kbd";

export function InputGroup18Example(): React.JSX.Element {
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
			<InputGroup>
				<InputGroupTextarea placeholder="Ask AI anything..." className="min-h-24 pb-12" />
				<InputGroupAddon align="block-end">
					<div className="flex items-center gap-1">
						<InputGroupButton variant="ghost" size="icon-xs">
							<PlusIcon className="size-4" />
						</InputGroupButton>
						<InputGroupButton variant="ghost" size="icon-xs">
							<MicIcon className="size-4" />
						</InputGroupButton>
						<InputGroupButton variant="ghost" className="h-7 px-2 text-xs">
							<GlobeIcon className="mr-1 size-3.5" />
							Search
						</InputGroupButton>
						<DropdownMenu>
							<DropdownMenuTrigger render={<InputGroupButton variant="ghost" className="h-7 px-2 text-xs" />}>
								<Kbd className="rounded-sm border border-border">Σ</Kbd>
								{model}
								<ChevronDownIcon className="ml-1 size-3.5 opacity-60" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="min-w-32">
								<DropdownMenuItem data-value="GPT-4o" onClick={handleSelect}>
									GPT-4o
								</DropdownMenuItem>
								<DropdownMenuItem data-value="GPT-4" onClick={handleSelect}>
									GPT-4
								</DropdownMenuItem>
								<DropdownMenuItem data-value="Claude 3.5" onClick={handleSelect}>
									Claude 3.5
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<InputGroupButton variant="default" size="icon-xs" className="ml-auto">
						<ArrowUpIcon className="size-4" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
