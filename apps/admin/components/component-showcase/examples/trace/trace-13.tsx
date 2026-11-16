import { CircleDashedIcon, DatabaseIcon, FlaskConicalIcon } from "lucide-react";
import type * as React from "react";

import { Card, CardContent } from "@workspace/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

interface BuiltModel {
	readonly name: string;
	readonly rows: string;
}

interface DuplicateRow {
	readonly orderId: string;
	readonly copies: number;
}

const MODELS: readonly BuiltModel[] = [
	{ name: "stg_orders", rows: "1.2M rows" },
	{ name: "stg_customers", rows: "84K rows" },
	{ name: "int_order_items", rows: "3.4M rows" },
	{ name: "fct_revenue", rows: "1.1M rows" },
];

const DUPLICATES: readonly DuplicateRow[] = [
	{ orderId: "ord_8821340", copies: 2 },
	{ orderId: "ord_8823004", copies: 3 },
];

// The skipped model stays listed as pending, so the run shows which report is
// stale.
export function Trace13Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-md text-sm">
			<Trace>
				<TraceCollapsible>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<DatabaseIcon />
							</TraceIcon>
							<TraceTitle>Built {MODELS.length} models</TraceTitle>
							<TraceDescription>1m 24s</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{MODELS.map((model: BuiltModel): React.JSX.Element => (
								<TraceLine key={model.name}>
									<TraceTitle>{model.name}</TraceTitle>
									<TraceDescription>{model.rows}</TraceDescription>
								</TraceLine>
							))}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine status="error">
							<TraceIcon>
								<FlaskConicalIcon />
							</TraceIcon>
							<TraceTitle>Unique test failed on fct_revenue</TraceTitle>
							<TraceDescription>{DUPLICATES.length} duplicates</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						{/* A borderless Card is the outer frame; the table sits flush in it. */}
						<Card className="p-0">
							<CardContent className="p-0">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="h-8">order_id</TableHead>
											<TableHead className="h-8 text-right">Copies</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{DUPLICATES.map((row: DuplicateRow): React.JSX.Element => (
											<TableRow key={row.orderId}>
												<TableCell className="py-1.5">
													<code className="text-xs">{row.orderId}</code>
												</TableCell>
												<TableCell className="py-1.5 text-right">{row.copies}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceLine status="pending">
					<TraceIcon>
						<CircleDashedIcon />
					</TraceIcon>
					<TraceTitle>Skipped dim_customer_ltv</TraceTitle>
					<TraceDescription>upstream failed</TraceDescription>
				</TraceLine>
			</Trace>
		</div>
	);
}
