"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/display/table";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import * as React from "react";

import type { TopMerchantRow } from "@/lib/analytics/sales-analytics";

/** Skeleton rows while loading — the API returns at most ten merchants. */
const SKELETON_ROW_COUNT = 5;
const SKELETON_ROW_KEYS: readonly string[] = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => `skeleton-${String(index)}`);

interface ColumnDefinition {
	readonly label: string;
	readonly isNumeric: boolean;
}

const COLUMNS: readonly ColumnDefinition[] = [
	{ label: "Merchant", isNumeric: false },
	{ label: "Category", isNumeric: false },
	{ label: "Sales", isNumeric: true },
	{ label: "Bills", isNumeric: true },
	{ label: "Share", isNumeric: true },
];

export interface TopMerchantsTableProps {
	/** `undefined` renders skeleton rows. */
	readonly rows: readonly TopMerchantRow[] | undefined;
	readonly description: string;
}

/** Highest-selling merchants of the period with their share of platform sales. */
export function TopMerchantsTable({ rows, description }: TopMerchantsTableProps): React.JSX.Element {
	return (
		<Card className="border-border/80 bg-card shadow-xs">
			<CardHeader>
				<CardTitle>Top merchants</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							{COLUMNS.map((column) => (
								<TableHead key={column.label} scope="col" className={column.isNumeric ? "text-right" : undefined}>
									{column.label}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows === undefined
							? SKELETON_ROW_KEYS.map((key) => (
									<TableRow key={key}>
										<TableCell colSpan={COLUMNS.length}>
											<Skeleton className="h-5 w-full" />
										</TableCell>
									</TableRow>
								))
							: rows.map((row) => (
									<TableRow key={row.organizationId}>
										<TableCell className="font-medium">{row.name}</TableCell>
										<TableCell className="text-muted-foreground">{row.categoryLabel}</TableCell>
										<TableCell className="text-right tabular-nums">{row.sales}</TableCell>
										<TableCell className="text-right tabular-nums">{row.bills}</TableCell>
										<TableCell className="text-right tabular-nums">{row.share}</TableCell>
									</TableRow>
								))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
