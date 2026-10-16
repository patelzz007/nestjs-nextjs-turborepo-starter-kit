// A grouped block of content on a screen. Two ways to fill it:
//
// - the shorthand: `<Card title="Devices" description="…">…</Card>`, which
//   draws the header for you;
// - the parts, as on the web: `CardHeader` (with `CardTitle` and
//   `CardDescription`), `CardContent` and `CardFooter`.
//
// The card spaces its parts; the parts never pad themselves, so they compose
// in any order. Never mark a card with a coloured edge stripe (rules/07).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View } from "react-native";

import { cn } from "../lib/cn";

export const cardVariants = cva("rounded-xl border border-border bg-card", {
	variants: {
		/** `md`: a screen's section. `sm`: a compact card in a list or a grid. */
		size: { md: "gap-4 p-4", sm: "gap-3 p-3" },
	},
	defaultVariants: { size: "md" },
});

export type CardSize = NonNullable<VariantProps<typeof cardVariants>["size"]>;

export interface CardProps {
	/** The shorthand header's title (or compose `CardHeader` + `CardTitle` yourself). */
	readonly title?: string;
	/** A line under the shorthand title. Shown only with `title`. */
	readonly description?: string;
	readonly size?: CardSize;
	readonly children: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const Card = React.memo(
	React.forwardRef<View, CardProps>(function Card({ title, description, size = "md", children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(cardVariants({ size }), className)} testID={testID}>
				{title === undefined ? null : (
					<CardHeader>
						<CardTitle>{title}</CardTitle>
						{description === undefined ? null : <CardDescription>{description}</CardDescription>}
					</CardHeader>
				)}
				{children}
			</View>
		);
	}),
);

interface CardPartProps {
	readonly children: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

interface CardTextProps {
	readonly children: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export type CardHeaderProps = CardPartProps;
export type CardContentProps = CardPartProps;
export type CardFooterProps = CardPartProps;
export type CardTitleProps = CardTextProps;
export type CardDescriptionProps = CardTextProps;

/** The title and description, stacked. */
export const CardHeader = React.memo(
	React.forwardRef<View, CardHeaderProps>(function CardHeader({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn("gap-1", className)} testID={testID}>
				{children}
			</View>
		);
	}),
);

/** The card's name; announced as a header by screen readers. */
export const CardTitle = React.memo(
	React.forwardRef<Text, CardTitleProps>(function CardTitle({ children, className, testID }, ref): React.JSX.Element {
		return (
			<Text ref={ref} accessibilityRole="header" className={cn("font-heading text-lg text-foreground", className)} testID={testID}>
				{children}
			</Text>
		);
	}),
);

/** A line on what the card is for. */
export const CardDescription = React.memo(
	React.forwardRef<Text, CardDescriptionProps>(function CardDescription({ children, className, testID }, ref): React.JSX.Element {
		return (
			<Text ref={ref} className={cn("font-sans text-sm text-muted-foreground", className)} testID={testID}>
				{children}
			</Text>
		);
	}),
);

/** The card's body. */
export const CardContent = React.memo(
	React.forwardRef<View, CardContentProps>(function CardContent({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn("gap-3", className)} testID={testID}>
				{children}
			</View>
		);
	}),
);

/** The card's actions, in a row. */
export const CardFooter = React.memo(
	React.forwardRef<View, CardFooterProps>(function CardFooter({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn("flex-row flex-wrap items-center gap-2", className)} testID={testID}>
				{children}
			</View>
		);
	}),
);
