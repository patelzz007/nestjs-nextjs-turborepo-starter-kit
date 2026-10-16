"use client";

import * as React from "react";
import { ListFilterIcon, MoreHorizontalIcon, SearchIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Checkbox } from "@workspace/ui/components/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";

type Status = "Active" | "Lead" | "Prospect";

const STATUSES: readonly Status[] = ["Active", "Lead", "Prospect"];

const STATUS_COUNTS: Readonly<Record<Status, number>> = {
	Active: 12,
	Lead: 7,
	Prospect: 5,
};

interface StatusFilterOptionProps {
	readonly idPrefix: string;
	readonly status: Status;
	readonly checked: boolean;
	readonly onToggle: (status: Status) => void;
	readonly children: React.ReactNode;
}

/** One checkbox row of the status filter; binds its own status to the shared toggle. */
function StatusFilterOption({ idPrefix, status, checked, onToggle, children }: StatusFilterOptionProps): React.JSX.Element {
	const id = `${idPrefix}-${status}`;
	const handleCheckedChange = useCallback((): void => {
		onToggle(status);
	}, [onToggle, status]);

	return (
		<div className="flex items-center gap-2.5">
			<Checkbox id={id} checked={checked} onCheckedChange={handleCheckedChange} />
			<Label htmlFor={id} className="flex grow items-center justify-between gap-1.5 font-normal">
				{children}
			</Label>
		</div>
	);
}

export function InputGroup39Example(): React.JSX.Element {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedStatuses, setSelectedStatuses] = useState<Status[]>([]);

	const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearchQuery(event.target.value);
	}, []);

	const handleClearSearch = useCallback((): void => {
		setSearchQuery("");
	}, []);

	const handleToggleStatus = useCallback((status: Status): void => {
		setSelectedStatuses((previous) => (previous.includes(status) ? previous.filter((item) => item !== status) : [...previous, status]));
	}, []);

	return (
		<Field className="max-w-sm">
			<InputGroup>
				<InputGroupAddon align="inline-start">
					<SearchIcon aria-hidden="true" />
				</InputGroupAddon>

				<InputGroupInput placeholder="Search contacts..." value={searchQuery} onChange={handleSearchChange} />

				<InputGroupAddon align="inline-end" className="gap-1">
					{searchQuery.length > 0 ? (
						<InputGroupButton aria-label="Clear search" size="icon-xs" variant="ghost" onClick={handleClearSearch}>
							<XIcon aria-hidden="true" />
						</InputGroupButton>
					) : null}

					<Popover>
						<PopoverTrigger render={<InputGroupButton variant="ghost" size="xs" className="gap-1.5" aria-label="Filter contacts" />}>
							<ListFilterIcon className="size-3.5" aria-hidden="true" />
							{selectedStatuses.length > 0 ? <span className="tabular-nums">{selectedStatuses.length}</span> : "Status"}
						</PopoverTrigger>
						<PopoverContent align="end" className="w-44 p-3">
							<div className="flex flex-col gap-2">
								{STATUSES.map((status) => (
									<StatusFilterOption key={status} idPrefix="contact-status" status={status} checked={selectedStatuses.includes(status)} onToggle={handleToggleStatus}>
										{status}
										<span className="text-xs text-muted-foreground">{STATUS_COUNTS[status]}</span>
									</StatusFilterOption>
								))}
							</div>
						</PopoverContent>
					</Popover>

					<DropdownMenu>
						<DropdownMenuTrigger render={<InputGroupButton variant="ghost" size="icon-xs" aria-label="More actions" />}>
							<MoreHorizontalIcon aria-hidden="true" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-36">
							<DropdownMenuGroup>
								<DropdownMenuItem>Bulk email</DropdownMenuItem>
								<DropdownMenuItem>Export CSV</DropdownMenuItem>
								<DropdownMenuItem>Add contact</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
