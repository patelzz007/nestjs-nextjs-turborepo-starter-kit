"use client";

import * as React from "react";
import { z } from "zod";

import { DataTable } from "@workspace/ui/components/data-table";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS } from "./data-table-sample";

const PAGE_SIZE = 5;
const SKELETON_ROWS = 5;

const TableStateSchema = z.enum(["loaded", "loading", "refetching", "empty", "error"]);
type TableState = z.output<typeof TableStateSchema>;

const STATE_LABELS: Readonly<Record<TableState, string>> = { loaded: "Loaded", loading: "First load", refetching: "Refetching", empty: "Empty", error: "Error" };

export function DataTable11Example(): React.JSX.Element {
	const [state, setState] = React.useState<TableState>("loading");
	const handleValueChange = React.useCallback((value: string | number | null): void => {
		const parsed = TableStateSchema.safeParse(value);
		setState(parsed.success ? parsed.data : "loaded");
	}, []);

	return (
		<div className="flex w-full flex-col gap-4">
			<Tabs value={state} onValueChange={handleValueChange}>
				<TabsList aria-label="Table state">
					{TableStateSchema.options.map((option: TableState): React.JSX.Element => (
						<TabsTrigger key={option} value={option}>
							{STATE_LABELS[option]}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<DataTable
				data={state === "empty" ? [] : DOCUMENT_SECTIONS}
				columns={SECTION_COLUMNS}
				isLoading={state === "loading"}
				isRefetching={state === "refetching"}
				skeletonRows={SKELETON_ROWS}
				error={state === "error" ? "The sections could not be loaded. Try again in a moment." : null}
				emptyState={{ title: "No sections yet", description: "Sections appear here once the proposal has some." }}
				pageSize={PAGE_SIZE}
				title="Loading, empty and error"
				description="Every state a fetched table goes through, from skeleton rows to an error."
			/>
		</div>
	);
}
