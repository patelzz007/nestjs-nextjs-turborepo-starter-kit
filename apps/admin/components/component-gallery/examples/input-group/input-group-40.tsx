"use client";

import * as React from "react";
import { ChevronDownIcon, CopyIcon, LinkIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

const DEFAULT_VISIBILITY = "Private";

const VISIBILITY_OPTIONS: readonly string[] = [DEFAULT_VISIBILITY, "Team", "Public"];

export function InputGroup40Example(): React.JSX.Element {
	const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);

	// Each menu item carries its option in `data-value`, so one handler serves them all.
	const handleSelect = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
		const { value } = event.currentTarget.dataset;
		if (value !== undefined) {
			setVisibility(value);
		}
	}, []);

	return (
		<Field className="max-w-sm">
			<InputGroup>
				<InputGroupAddon align="inline-start">
					<LinkIcon className="size-4 opacity-60" aria-hidden="true" />
				</InputGroupAddon>

				<InputGroupInput defaultValue="agentflow.ai/runbooks/q2-review" aria-label="Share link" />

				<InputGroupAddon align="inline-end" className="gap-1">
					<DropdownMenu>
						<DropdownMenuTrigger render={<InputGroupButton variant="ghost" size="xs" className="gap-1.5" aria-label="Select visibility" />}>
							{visibility}
							<ChevronDownIcon className="size-3 opacity-60" aria-hidden="true" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-28">
							<DropdownMenuGroup>
								{VISIBILITY_OPTIONS.map((item) => (
									<DropdownMenuItem key={item} data-value={item} onClick={handleSelect}>
										{item}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>

					<InputGroupButton variant="ghost" size="icon-xs" aria-label="Copy link">
						<CopyIcon aria-hidden="true" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
