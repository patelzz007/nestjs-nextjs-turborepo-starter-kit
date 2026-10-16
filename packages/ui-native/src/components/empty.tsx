// Loading, empty and error states of a screen or section. Presentational: the
// caller passes the words (and, for an error, what retrying does).
//
// - LoadingState: a spinner and what is loading — for a small area whose
//   shape is unknown; a section with a known shape loads behind a SkeletonGroup.
// - EmptyState: nothing to show yet, optionally with a glyph, a title and an
//   action (`children`).
// - ErrorState: the failure, announced as an alert, and a retry.

import { cva } from "class-variance-authority";
import * as React from "react";
import { Text, View } from "react-native";

import { cn } from "../lib/cn";
import { Alert } from "./alert";
import { Button } from "./button";
import { IconTile } from "./icon-tile";
import { type LucideIcon } from "./icon";
import { Spinner } from "./spinner";
import { MutedText } from "./text";

export const loadingStateVariants = cva("items-center gap-3 py-8");
export const emptyStateVariants = cva("gap-3 rounded-lg border border-dashed border-border px-4 py-6");
export const errorStateVariants = cva("gap-3");

export interface LoadingStateProps {
	/** Announced to screen readers ("Loading your devices…"). */
	readonly label: string;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const LoadingState = React.memo(
	React.forwardRef<View, LoadingStateProps>(function LoadingState({ label, className, testID }, ref): React.JSX.Element {
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
	/** A glyph for what is missing, in a neutral tile; decorative. */
	readonly icon?: LucideIcon;
	/** The way forward (a "Create" button). */
	readonly children?: React.ReactNode;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const EmptyState = React.memo(
	React.forwardRef<View, EmptyStateProps>(function EmptyState({ message, title, icon, children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(emptyStateVariants(), className)}>
				{icon === undefined ? null : <IconTile icon={icon} />}
				{title === undefined ? null : <Text className="font-sans-semibold text-base text-foreground">{title}</Text>}
				<MutedText>{message}</MutedText>
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
	React.forwardRef<View, ErrorStateProps>(function ErrorState({ message, retryLabel, onRetry, retrying = false, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(errorStateVariants(), className)}>
				<Alert tone="error" message={message} />
				<Button label={retryLabel} variant="secondary" onPress={onRetry} loading={retrying} />
			</View>
		);
	}),
);
