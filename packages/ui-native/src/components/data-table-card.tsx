// A DataTable row as a card (the web's `DataTableMobileCard`): a title and a line under it, a badge, a grid of
// labelled values and the row's actions as buttons. `DataTable`'s `renderCard` hands each row's actions, already
// bound to the row, so the card stays presentational.

import { cva } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Button } from "./button";
import type { DataTableBoundAction } from "./data-table";

export const dataTableCardVariants = cva("w-full gap-3 rounded-lg border border-border bg-card p-4");

/** One labelled value in the card's grid. */
export interface DataTableCardField {
	readonly label: string;
	readonly value: string;
}

export interface DataTableCardProps {
	readonly title: string;
	readonly subtitle?: string | undefined;
	/** At the title's end: a status badge. */
	readonly badge?: React.ReactNode | undefined;
	/** Labelled values, two to a line. */
	readonly fields?: readonly DataTableCardField[] | undefined;
	/** The row's actions (from `renderCard`), one button each. */
	readonly actions?: readonly DataTableBoundAction[] | undefined;
	/** Extra classes for the card, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const NO_FIELDS: readonly DataTableCardField[] = [];
const NO_ACTIONS: readonly DataTableBoundAction[] = [];

export const DataTableCard = React.memo(
	React.forwardRef<ViewInstance, DataTableCardProps>(function DataTableCard(
		{ title, subtitle, badge, fields = NO_FIELDS, actions = NO_ACTIONS, className, testID },
		ref,
	): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(dataTableCardVariants(), className)}>
				<View className="flex-row items-start justify-between gap-3">
					<View className="min-w-0 flex-1 gap-1">
						<Text numberOfLines={1} className="text-label font-sans-semibold text-foreground">
							{title}
						</Text>
						{subtitle === undefined ? null : (
							<Text numberOfLines={1} className="text-label font-sans text-muted-foreground">
								{subtitle}
							</Text>
						)}
					</View>
					{badge ?? null}
				</View>
				{fields.length === 0 ? null : (
					<View className="flex-row flex-wrap gap-y-2">
						{fields.map((field): React.JSX.Element => (
							<View key={field.label} accessible accessibilityLabel={`${field.label}: ${field.value}`} className="w-1/2 gap-0.5 pr-2">
								<Text className="text-caption font-sans text-muted-foreground">{field.label}</Text>
								<Text className="text-label font-sans-medium text-foreground">{field.value}</Text>
							</View>
						))}
					</View>
				)}
				{actions.length === 0 ? null : (
					<View className="gap-2 border-t border-border pt-3">
						{actions.map((action): React.JSX.Element => (
							<Button key={action.key} label={action.label} icon={action.icon} variant={action.destructive ? "destructive" : "outline"} onPress={action.onPress} />
						))}
					</View>
				)}
			</View>
		);
	}),
);
