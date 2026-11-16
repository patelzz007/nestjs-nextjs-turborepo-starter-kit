// Loading, empty and error states of a screen or section. Presentational: the
// caller passes the words (and, for an error, what retrying does).
//
// - LoadingState: a spinner and what is loading — for a small area whose
//   shape is unknown; a section with a known shape loads behind a SkeletonGroup.
// - EmptyState: nothing to show yet, optionally with a glyph, a title and an
//   action (`children`).
// - ErrorState: the failure, announced as an alert, and a retry.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Alert } from "./alert";
import { Button } from "./button";
import { IconTile, type IconTileTone } from "./icon-tile";
import { type LucideIcon } from "./icon";
import { Spinner } from "./spinner";
import { MutedText } from "./text";

export const loadingStateVariants = cva("items-center gap-3 py-8");
export const emptyStateVariants = cva("gap-3 px-5 py-6", {
	variants: {
		/** `muted` (default): a filled panel. `outline`: a bordered card. `dashed`: a dashed drop area. `plain`: no surface. */
		variant: { muted: "rounded-card bg-muted", outline: "rounded-card border border-border bg-card", dashed: "rounded-card border-2 border-dashed border-input", plain: "" },
		align: { start: "", center: "items-center" },
	},
	defaultVariants: { variant: "muted", align: "start" },
});
export const errorStateVariants = cva("gap-3");

type EmptyStateVariantProps = VariantProps<typeof emptyStateVariants>;
export type EmptyStateVariant = NonNullable<EmptyStateVariantProps["variant"]>;
export type EmptyStateAlign = NonNullable<EmptyStateVariantProps["align"]>;

export interface LoadingStateProps {
	/** Announced to screen readers ("Loading your devices…"). */
	readonly label: string;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const LoadingState = React.memo(
	React.forwardRef<ViewInstance, LoadingStateProps>(function LoadingState({ label, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} accessible accessibilityRole="progressbar" accessibilityLabel={label} testID={testID} className={cn(loadingStateVariants(), className)}>
				<Spinner size="lg" variant="muted" />
				<MutedText>{label}</MutedText>
			</View>
		);
	}),
);

export interface EmptyStateProps {
	readonly message: string;
	/** A short heading above the message ("No devices"). */
	readonly title?: string;
	/** A glyph for what is missing, in a tile; decorative. */
	readonly icon?: LucideIcon;
	/** The glyph tile's tint. Default `neutral`. */
	readonly iconTone?: IconTileTone | undefined;
	/** A drawing in place of the glyph (cards, a chat, a calendar). Decorative. */
	readonly illustration?: React.ReactNode | undefined;
	readonly variant?: EmptyStateVariant | undefined;
	/** Lines up the content at the start (default) or the centre. */
	readonly align?: EmptyStateAlign | undefined;
	/** The way forward (a "Create" button). */
	readonly children?: React.ReactNode;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const EmptyState = React.memo(
	React.forwardRef<ViewInstance, EmptyStateProps>(function EmptyState(
		{ message, title, icon, iconTone = "neutral", illustration, variant = "muted", align = "start", children, className, testID },
		ref,
	): React.JSX.Element {
		const centred = align === "center" ? "text-center" : undefined;
		return (
			<View ref={ref} testID={testID} className={cn(emptyStateVariants({ variant, align }), className)}>
				{illustration === undefined ? null : <View importantForAccessibility="no-hide-descendants">{illustration}</View>}
				{icon === undefined || illustration !== undefined ? null : <IconTile icon={icon} tone={iconTone} />}
				{title === undefined ? null : <Text className={cn("font-sans-semibold text-body-lg text-foreground", centred)}>{title}</Text>}
				<MutedText className={cn(centred)}>{message}</MutedText>
				{children}
			</View>
		);
	}),
);

export interface ErrorStateProps {
	readonly message: string;
	readonly retryLabel: string;
	readonly onRetry: () => void;
	/** A retry is in flight: the button shows a spinner and blocks presses. */
	readonly retrying?: boolean;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const ErrorState = React.memo(
	React.forwardRef<ViewInstance, ErrorStateProps>(function ErrorState({ message, retryLabel, onRetry, retrying = false, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(errorStateVariants(), className)}>
				<Alert tone="error" message={message} />
				<Button label={retryLabel} variant="outline" onPress={onRetry} loading={retrying} />
			</View>
		);
	}),
);
