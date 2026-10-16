"use client";

import type * as React from "react";
import { useCallback, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";

import { cn } from "@workspace/ui/lib/core/utils";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Status {
	readonly value: string;
	readonly label: string;
	readonly color: string;
}

const statuses: readonly Status[] = [
	{ value: "ready", label: "Ready", color: "bg-success" },
	{ value: "error", label: "Error", color: "bg-destructive" },
	{ value: "building", label: "Building", color: "bg-warning" },
	{ value: "queued", label: "Queued", color: "bg-info" },
	{ value: "initializing", label: "Initializing", color: "bg-primary" },
	{ value: "canceled", label: "Canceled", color: "bg-tone-violet" },
];

/** Every status starts selected except "Canceled". */
const INITIAL_SELECTION: string[] = statuses.filter((status) => status.value !== "canceled").map((status) => status.value);

export function Select23Example(): React.JSX.Element {
	const [selected, setSelected] = useState<string[]>(INITIAL_SELECTION);

	const handleValueChange = useCallback((values: string[]): void => {
		setSelected(values);
	}, []);

	const selectedData = statuses.filter((status) => selected.includes(status.value));

	return (
		<Field className="max-w-xs">
			<Select multiple value={selected} onValueChange={handleValueChange} items={statuses}>
				<SelectTrigger className="w-full justify-between">
					<SelectValue>
						<div className="flex items-center gap-2 overflow-hidden">
							<div className="flex -space-x-1 overflow-hidden">
								{selectedData.map((status) => (
									<div key={status.value} className={cn("size-2.5 shrink-0 rounded-full ring-2 ring-background", status.color)} />
								))}
							</div>
							<span className="truncate">Status</span>
							<Badge variant="outline" size="sm">
								{selected.length}/{statuses.length}
							</Badge>
						</div>
					</SelectValue>
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false} className="min-w-48">
					<SelectGroup>
						{statuses.map((status) => (
							<SelectItem key={status.value} value={status.value}>
								<div className="flex items-center gap-2">
									<div className={cn("size-2 rounded-full", status.color)} />
									<span>{status.label}</span>
								</div>
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
