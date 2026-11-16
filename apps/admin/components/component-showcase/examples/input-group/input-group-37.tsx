"use client";

import * as React from "react";
import { ListFilterIcon, SearchIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";

type Status = "Pending" | "Shipped" | "Cancelled";

const STATUSES: readonly Status[] = ["Pending", "Shipped", "Cancelled"];

function toggleStatus(values: readonly Status[], value: Status): Status[] {
	return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

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
			<Label htmlFor={id} className="text-sm font-normal">
				{children}
			</Label>
		</div>
	);
}

export function InputGroup37Example(): React.JSX.Element {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedStatuses, setSelectedStatuses] = useState<Status[]>([]);

	const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearchQuery(event.target.value);
	}, []);

	const handleClearSearch = useCallback((): void => {
		setSearchQuery("");
	}, []);

	const handleToggleStatus = useCallback((status: Status): void => {
		setSelectedStatuses((previous) => toggleStatus(previous, status));
	}, []);

	return (
		<Field className="max-w-sm">
			<InputGroup>
				<InputGroupAddon align="inline-start">
					<SearchIcon aria-hidden="true" />
				</InputGroupAddon>

				<InputGroupInput placeholder="Search orders..." value={searchQuery} onChange={handleSearchChange} />

				<InputGroupAddon align="inline-end" className="gap-1">
					{searchQuery.length > 0 ? (
						<InputGroupButton aria-label="Clear search" size="icon-xs" variant="ghost" onClick={handleClearSearch}>
							<XIcon aria-hidden="true" />
						</InputGroupButton>
					) : null}

					<Popover>
						<PopoverTrigger render={<InputGroupButton variant="ghost" size="xs" className="gap-1.5" aria-label="Filter order status" />}>
							<ListFilterIcon className="size-3.5" aria-hidden="true" />
							Status
							{selectedStatuses.length > 0 ? <span className="text-muted-foreground tabular-nums">{selectedStatuses.length}</span> : null}
						</PopoverTrigger>
						<PopoverContent align="end" className="w-40 p-3">
							<div className="flex flex-col gap-2">
								{STATUSES.map((status) => (
									<StatusFilterOption key={status} idPrefix="order-status" status={status} checked={selectedStatuses.includes(status)} onToggle={handleToggleStatus}>
										{status}
									</StatusFilterOption>
								))}
							</div>
						</PopoverContent>
					</Popover>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
