"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup12Example(): React.JSX.Element {
	const [country, setCountry] = useState("+1");

	// The menu items carry their option in `data-value`, so one handler serves them all.
	const handleSelect = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
		const { value } = event.currentTarget.dataset;
		if (value !== undefined) {
			setCountry(value);
		}
	}, []);

	return (
		<Field className="w-full max-w-xs">
			<InputGroup>
				<InputGroupAddon>
					<DropdownMenu>
						<DropdownMenuTrigger render={<InputGroupButton variant="ghost" />}>
							<span className="tabular-nums">{country}</span>
							<ChevronDownIcon />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="min-w-24">
							<DropdownMenuItem data-value="+1" onClick={handleSelect}>
								+1 (US)
							</DropdownMenuItem>
							<DropdownMenuItem data-value="+44" onClick={handleSelect}>
								+44 (UK)
							</DropdownMenuItem>
							<DropdownMenuItem data-value="+61" onClick={handleSelect}>
								+61 (AU)
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</InputGroupAddon>
				<InputGroupInput type="tel" placeholder="123 456 7890" />
			</InputGroup>
		</Field>
	);
}
