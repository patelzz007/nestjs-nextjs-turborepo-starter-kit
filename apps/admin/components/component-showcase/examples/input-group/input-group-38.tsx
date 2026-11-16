"use client";

import * as React from "react";
import { ChevronDownIcon, GlobeIcon, SearchIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

const DEFAULT_REGION = "Global";

const REGIONS: readonly string[] = [DEFAULT_REGION, "United States", "Europe", "APAC"];

export function InputGroup38Example(): React.JSX.Element {
	const [searchQuery, setSearchQuery] = useState("");
	const [region, setRegion] = useState(DEFAULT_REGION);

	const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearchQuery(event.target.value);
	}, []);

	const handleClearSearch = useCallback((): void => {
		setSearchQuery("");
	}, []);

	// Each menu item carries its region in `data-value`, so one handler serves them all.
	const handleRegionSelect = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
		const { value } = event.currentTarget.dataset;
		if (value !== undefined) {
			setRegion(value);
		}
	}, []);

	return (
		<Field className="max-w-sm">
			<InputGroup>
				<InputGroupAddon align="inline-start">
					<SearchIcon aria-hidden="true" />
				</InputGroupAddon>

				<InputGroupInput placeholder="Search companies..." value={searchQuery} onChange={handleSearchChange} />

				<InputGroupAddon align="inline-end" className="gap-1">
					{searchQuery.length > 0 ? (
						<InputGroupButton aria-label="Clear search" size="icon-xs" variant="ghost" onClick={handleClearSearch}>
							<XIcon aria-hidden="true" />
						</InputGroupButton>
					) : null}

					<DropdownMenu>
						<DropdownMenuTrigger render={<InputGroupButton variant="ghost" size="xs" className="gap-1.5" aria-label="Select region" />}>
							<GlobeIcon className="size-3.5" aria-hidden="true" />
							{region}
							<ChevronDownIcon className="size-3 opacity-60" aria-hidden="true" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-32">
							<DropdownMenuGroup>
								{REGIONS.map((item) => (
									<DropdownMenuItem key={item} data-value={item} onClick={handleRegionSelect}>
										{item}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
