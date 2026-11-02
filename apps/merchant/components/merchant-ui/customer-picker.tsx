"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SearchIcon, XIcon } from "lucide-react";
import * as React from "react";

/** One customer the merchant can pick: a name and a masked email, never the full address. */
export interface CustomerPickerOption {
	readonly userId: string;
	readonly fullName: string;
	readonly maskedEmail: string | null;
	/** A short line under the name ("Claimed 3 times · last 2 days ago"). */
	readonly detail: string;
	/** Why this customer cannot be picked (e.g. "Opted out"); null = they can. */
	readonly unavailableReason: string | null;
}

export interface CustomerPickerProps {
	/** The id the field's heading uses, so the picker is announced under it. */
	readonly id: string;
	readonly search: string;
	readonly onSearchChange: (search: string) => void;
	/** The customers matching the search (one page). */
	readonly options: readonly CustomerPickerOption[];
	/** The customers picked so far, in the order they were picked. */
	readonly selected: readonly CustomerPickerOption[];
	readonly onAdd: (option: CustomerPickerOption) => void;
	readonly onRemove: (userId: string) => void;
	readonly isLoading: boolean;
	readonly isError: boolean;
	/** How many customers may be picked at most. */
	readonly max: number;
	readonly disabled?: boolean;
	/** The field's validation message, shown under it. */
	readonly errorMessage?: string | undefined;
}

/** How long a customer search waits after the last keystroke before it asks the API. */
export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;

/** How many placeholder rows show while the first page loads. */
const LOADING_ROWS = 3;

/**
 * Pick customers by hand: search by name or email, tick the people, and see who is picked as removable
 * chips. Data-agnostic: the owner fetches the options and holds the selection.
 */
export function CustomerPicker({
	id,
	search,
	onSearchChange,
	options,
	selected,
	onAdd,
	onRemove,
	isLoading,
	isError,
	max,
	disabled = false,
	errorMessage,
}: CustomerPickerProps): React.JSX.Element {
	const selectedIds = React.useMemo((): ReadonlySet<string> => new Set(selected.map((option) => option.userId)), [selected]);
	const isFull = selected.length >= max;
	const errorId = `${id}-error`;

	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onSearchChange(event.currentTarget.value);
		},
		[onSearchChange],
	);

	return (
		<div className="flex flex-col gap-3" data-slot="customer-picker">
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<p className="text-sm font-medium text-foreground">Chosen customers</p>
					<span className="text-xs text-muted-foreground tabular-nums">
						{selected.length} of {max}
					</span>
				</div>
				{selected.length === 0 ? (
					<p className="text-sm text-muted-foreground">No one yet. Search below and tick the customers this is for.</p>
				) : (
					<ul aria-label="Chosen customers" className="flex flex-wrap gap-1.5">
						{selected.map((option): React.JSX.Element => (
							<li key={option.userId}>
								<CustomerChip option={option} onRemove={onRemove} disabled={disabled} />
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="relative">
				<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
				<Input
					id={`${id}-search`}
					type="search"
					value={search}
					onChange={handleSearchChange}
					placeholder="Search customers by name or email"
					aria-label="Search customers"
					disabled={disabled}
					className="pl-9"
					{...(errorMessage === undefined ? {} : { "aria-invalid": true, "aria-describedby": errorId })}
				/>
			</div>

			<CustomerResults
				options={options}
				selectedIds={selectedIds}
				onAdd={onAdd}
				onRemove={onRemove}
				isLoading={isLoading}
				isError={isError}
				isFull={isFull}
				disabled={disabled}
				searching={search.trim().length > 0}
			/>

			{isFull ? <p className="text-xs text-muted-foreground">{`That's the most one pick can hold. To reach more people, choose everyone instead.`}</p> : null}
			{errorMessage === undefined ? null : (
				<p id={errorId} role="alert" className="text-sm text-destructive">
					{errorMessage}
				</p>
			)}
		</div>
	);
}

interface CustomerChipProps {
	readonly option: CustomerPickerOption;
	readonly onRemove: (userId: string) => void;
	readonly disabled: boolean;
}

function CustomerChip({ option, onRemove, disabled }: CustomerChipProps): React.JSX.Element {
	const handleRemove = React.useCallback((): void => {
		onRemove(option.userId);
	}, [onRemove, option.userId]);

	return (
		<Badge variant="secondary" className="h-7 gap-1 pr-0.5 pl-2.5">
			<span className="max-w-48 truncate">{option.fullName}</span>
			<Button type="button" variant="ghost" size="icon-xs" onClick={handleRemove} disabled={disabled} aria-label={`Remove ${option.fullName}`}>
				<XIcon aria-hidden="true" />
			</Button>
		</Badge>
	);
}

interface CustomerResultsProps {
	readonly options: readonly CustomerPickerOption[];
	readonly selectedIds: ReadonlySet<string>;
	readonly onAdd: (option: CustomerPickerOption) => void;
	readonly onRemove: (userId: string) => void;
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly isFull: boolean;
	readonly disabled: boolean;
	readonly searching: boolean;
}

function CustomerResults({ options, selectedIds, onAdd, onRemove, isLoading, isError, isFull, disabled, searching }: CustomerResultsProps): React.JSX.Element {
	if (isError) {
		return <p className="rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">{`Couldn't load your customers. Check your connection and try again.`}</p>;
	}
	if (isLoading && options.length === 0) {
		return (
			<div className="flex flex-col gap-1.5" aria-busy="true" aria-label="Loading customers">
				{Array.from({ length: LOADING_ROWS }, (_unused, index) => (
					<Skeleton key={index} className="h-12 w-full rounded-lg" />
				))}
			</div>
		);
	}
	if (options.length === 0) {
		return (
			<p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
				{searching ? "No customer matches that search." : "No customers yet. People become your customers when they claim one of your rewards."}
			</p>
		);
	}
	return (
		<ul aria-label="Customers" className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
			{options.map((option): React.JSX.Element => (
				<li key={option.userId}>
					<CustomerRow
						option={option}
						checked={selectedIds.has(option.userId)}
						onAdd={onAdd}
						onRemove={onRemove}
						disabled={disabled || option.unavailableReason !== null || (isFull && !selectedIds.has(option.userId))}
					/>
				</li>
			))}
		</ul>
	);
}

interface CustomerRowProps {
	readonly option: CustomerPickerOption;
	readonly checked: boolean;
	readonly onAdd: (option: CustomerPickerOption) => void;
	readonly onRemove: (userId: string) => void;
	readonly disabled: boolean;
}

function CustomerRow({ option, checked, onAdd, onRemove, disabled }: CustomerRowProps): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(nextChecked: boolean): void => {
			if (nextChecked) {
				onAdd(option);
			} else {
				onRemove(option.userId);
			}
		},
		[onAdd, onRemove, option],
	);

	return (
		<Label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 font-normal transition-colors duration-150 hover:bg-foreground/5 has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60 motion-reduce:transition-none">
			<Checkbox checked={checked} onCheckedChange={handleCheckedChange} disabled={disabled} />
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm font-medium text-foreground">{option.fullName}</span>
				<span className="truncate text-xs text-muted-foreground">{[option.maskedEmail, option.detail].filter((part) => part !== null && part.length > 0).join(" · ")}</span>
			</span>
			{option.unavailableReason === null ? null : (
				<Badge variant="outline" className="shrink-0">
					{option.unavailableReason}
				</Badge>
			)}
		</Label>
	);
}
