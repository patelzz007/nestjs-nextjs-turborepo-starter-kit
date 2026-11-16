// What the Chart examples share: the card each chart sits in (a title with its trend, a line under it), the
// formats for months, counts and dollars, rows in the web examples' shape as chart data, and the figure in a
// donut's hole.

import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import type { ChartDatum } from "@workspace/ui-native/components/chart";
import TrendingDownIcon from "lucide-react-native/icons/trending-down";
import TrendingUpIcon from "lucide-react-native/icons/trending-up";
import * as React from "react";
import { Text, View } from "react-native";

/** A change against the last period, and how it reads (the web's light badges). */
export interface ChartTrend {
	readonly label: string;
	readonly tone: BadgeTone;
}

export interface ChartCardProps {
	readonly title: string;
	readonly trend?: ChartTrend | undefined;
	readonly description: string;
	/** A large figure at the title's end (the selected month's value). */
	readonly headline?: string | undefined;
	readonly children: React.ReactNode;
}

export function ChartCard({ title, trend, description, headline, children }: ChartCardProps): React.JSX.Element {
	return (
		<Card className="w-full">
			<CardHeader>
				<View className="flex-row flex-wrap items-center gap-2">
					<CardTitle>{title}</CardTitle>
					{trend === undefined ? null : (
						<Badge label={trend.label} tone={trend.tone} variant="light" size="sm" icon={trend.label.startsWith("-") ? TrendingDownIcon : TrendingUpIcon} />
					)}
					{headline === undefined ? null : <Text className="text-h3 font-sans-semibold ml-auto text-foreground tabular-nums">{headline}</Text>}
				</View>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

/** Characters kept by `abbreviateMonth` ("January" → "Jan"). */
const MONTH_ABBREVIATION_LENGTH = 3;

/** Axis label for month names: "January" → "Jan". */
export function abbreviateMonth(month: string): string {
	return month.slice(0, MONTH_ABBREVIATION_LENGTH);
}

/** Every third digit from the right, where a thousands separator goes. */
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/gu;

/** A whole number with thousands separators: 12800 → "12,800". */
export function formatCount(value: number): string {
	return String(Math.round(value)).replace(THOUSANDS, ",");
}

/** Whole US dollars: 2400 → "$2,400". */
export function formatUsd(value: number): string {
	return `$${formatCount(value)}`;
}

/** The top of a 0–100 score scale. */
export const SCORE_MAX = 100;

/** A score out of 100: 76 → "76/100". */
export function formatScore(value: number): string {
	return `${String(value)}/${String(SCORE_MAX)}`;
}

/** Rows in the web examples' shape (`{ month: "Jan", desktop: 300 }`) as chart data, labelled by `labelKey`. */
export function chartDataOf(rows: readonly Readonly<Record<string, string | number>>[], labelKey: string): readonly ChartDatum[] {
	return rows.map((row): ChartDatum => {
		const values: Record<string, number> = {};
		for (const [key, value] of Object.entries(row)) {
			if (key !== labelKey) {
				values[key] = Number(value);
			}
		}
		return { label: String(row[labelKey] ?? ""), values };
	});
}

/** The figure in a donut's hole, with its caption under it. */
export function DonutCenter({ value, caption }: { readonly value: string; readonly caption: string }): React.JSX.Element {
	return (
		<View className="items-center">
			<Text className="text-h2 font-sans-semibold text-foreground tabular-nums">{value}</Text>
			<Text className="text-caption font-sans text-muted-foreground">{caption}</Text>
		</View>
	);
}
