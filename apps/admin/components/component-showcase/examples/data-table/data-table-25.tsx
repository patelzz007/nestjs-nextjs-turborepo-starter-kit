"use client";

import * as React from "react";

import { DataTable, type DataTableFooter } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const SHOWN_SECTION_COUNT = 8;
const SECTIONS: readonly DocumentSection[] = DOCUMENT_SECTIONS.slice(0, SHOWN_SECTION_COUNT);

interface PageTotals {
	readonly target: number;
	readonly limit: number;
}

const NO_PAGES: PageTotals = { target: 0, limit: 0 };

function addSection(totals: PageTotals, section: DocumentSection): PageTotals {
	return { target: totals.target + section.target, limit: totals.limit + section.limit };
}

function isDone(section: DocumentSection): boolean {
	return section.status === "Done";
}

const pages = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/**
 * Rows under the body, each keyed by column id: a column with no entry stays empty. The table only draws them; the
 * example works the figures out, so a total can be a sum, an average or anything else.
 */
export function DataTable25Example(): React.JSX.Element {
	const footer = React.useMemo((): DataTableFooter => {
		const all = SECTIONS.reduce(addSection, NO_PAGES);
		const done = SECTIONS.filter(isDone).reduce(addSection, NO_PAGES);
		return {
			rows: [
				{
					key: "done",
					cells: { header: <span className="text-muted-foreground">Done</span>, target: pages.format(done.target), limit: pages.format(done.limit) },
				},
				{
					key: "average",
					cells: {
						header: <span className="text-muted-foreground">Average per section</span>,
						target: pages.format(all.target / SECTIONS.length),
						limit: pages.format(all.limit / SECTIONS.length),
					},
				},
				{
					key: "total",
					cells: {
						header: <span className="font-medium">Total</span>,
						target: <span className="font-medium">{pages.format(all.target)}</span>,
						limit: <span className="font-medium">{pages.format(all.limit)}</span>,
					},
				},
			],
		};
	}, []);

	return <DataTable data={SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} footer={footer} />;
}
