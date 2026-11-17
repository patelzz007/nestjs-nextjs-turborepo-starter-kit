"use client";

import type { ExposureCount, ExposureStats } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import * as React from "react";

import { DECISION_SOURCE_LABELS, formatWhen } from "../lib/release-labels";

function ExposureTable({ label, rows }: { readonly label: string; readonly rows: readonly ExposureCount[] }): React.JSX.Element {
	return (
		<div className="flex flex-col gap-2">
			<h3 className="text-sm font-medium">{label}</h3>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">Nobody was given a value.</p>
			) : (
				<Table aria-label={label}>
					<TableHeader>
						<TableRow>
							<TableHead>Decided by</TableHead>
							<TableHead>Value</TableHead>
							<TableHead className="text-right">Times</TableHead>
							<TableHead className="text-right">Subjects</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row): React.JSX.Element => (
							<TableRow key={`${row.source}|${row.ruleId ?? "-"}|${row.value}`}>
								<TableCell>{DECISION_SOURCE_LABELS[row.source]}</TableCell>
								<TableCell className="font-mono text-xs">{row.value}</TableCell>
								<TableCell className="text-right tabular-nums">{row.exposures.toLocaleString("en-GB")}</TableCell>
								<TableCell className="text-right tabular-nums">{row.subjects.toLocaleString("en-GB")}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}

/** Who was given which value, over the last day and week (exposures, sent by the apps and the API's own checks). */
export function ExposureStatsCard({ stats }: { readonly stats: ExposureStats }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Who it reached</CardTitle>
				<CardDescription>{`Each time a screen or the API used it. Last used ${formatWhen(stats.lastExposureAt)}.`}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6 lg:grid-cols-2">
				<ExposureTable label="Last 24 hours" rows={stats.last24h} />
				<ExposureTable label="Last 7 days" rows={stats.last7d} />
			</CardContent>
		</Card>
	);
}
