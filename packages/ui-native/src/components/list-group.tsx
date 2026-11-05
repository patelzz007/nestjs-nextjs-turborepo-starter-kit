// A grouped list (ADR 079): related rows on ONE rounded surface, an inset hairline between them, an
// optional title above the surface and an optional note under it — the shape of every settings list.
// The group owns the surface, the rows' side padding and the lines; the rows (`ListRow`, `Switch`,
// anything) stay as they are, so a row never draws its own card. Never put a group inside a `Card`:
// it is the card.
//
// Presentational: the caller gives the rows in order; `null` / `false` children (a row shown only
// sometimes) leave no gap and no stray line.

import { cva } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Separator } from "./separator";

export const listGroupVariants = cva("gap-2");
/** The one surface the rows sit on. */
export const listGroupSurfaceVariants = cva("overflow-hidden rounded-2xl border border-border bg-card");
export const listGroupTitleVariants = cva("font-sans-semibold px-1 text-sm text-muted-foreground");
export const listGroupFooterVariants = cva("px-1 font-sans text-sm leading-5 text-muted-foreground");
/** Each row's side padding inside the surface. */
export const listGroupRowVariants = cva("px-4");

export interface ListGroupProps {
	/** Names the group, above its surface ("Preferences"); announced as a header. */
	readonly title?: string;
	/** A note under the surface: what the group's settings affect. */
	readonly footer?: string;
	readonly children: React.ReactNode;
	/** Extra classes for the group, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** A row's key: the one `Children.toArray` gave it (every element has one), or its place for plain text. */
function rowKeyOf(row: React.ReactNode, position: number): React.Key {
	return React.isValidElement(row) && row.key !== null ? row.key : `text-${String(position)}`;
}

export const ListGroup = React.memo(
	React.forwardRef<ViewInstance, ListGroupProps>(function ListGroup({ title, footer, children, className, testID }, ref): React.JSX.Element {
		// `toArray` drops `null`, `false` and `undefined` and keys each row, so the lines go only between real rows.
		const rows = React.Children.toArray(children);
		return (
			<View ref={ref} className={cn(listGroupVariants(), className)} testID={testID}>
				{title === undefined ? null : (
					<Text accessibilityRole="header" className={listGroupTitleVariants()} testID={testID === undefined ? undefined : `${testID}-title`}>
						{title}
					</Text>
				)}
				<View className={listGroupSurfaceVariants()} testID={testID === undefined ? undefined : `${testID}-surface`}>
					{rows.map((row, position) => (
						<View key={rowKeyOf(row, position)} className={listGroupRowVariants()}>
							{position === 0 ? null : <Separator {...(testID === undefined ? {} : { testID: `${testID}-line` })} />}
							{row}
						</View>
					))}
				</View>
				{footer === undefined ? null : (
					<Text className={listGroupFooterVariants()} testID={testID === undefined ? undefined : `${testID}-footer`}>
						{footer}
					</Text>
				)}
			</View>
		);
	}),
);
