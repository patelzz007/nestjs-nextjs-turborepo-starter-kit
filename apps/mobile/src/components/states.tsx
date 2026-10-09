// Loading, empty and error states of a screen or section.

import * as React from "react";
import { ActivityIndicator, View } from "react-native";

import { Banner } from "./banner";
import { Button } from "./button";
import { MutedText } from "./text";

export interface LoadingStateProps {
	/** Announced to screen readers ("Loading your devices…"). */
	readonly label: string;
}

export function LoadingState({ label }: LoadingStateProps): React.JSX.Element {
	return (
		<View accessible accessibilityRole="progressbar" accessibilityLabel={label} className="items-center gap-3 py-8">
			<ActivityIndicator size="large" colorClassName="accent-muted-foreground" />
			<MutedText>{label}</MutedText>
		</View>
	);
}

export interface EmptyStateProps {
	readonly message: string;
}

export function EmptyState({ message }: EmptyStateProps): React.JSX.Element {
	return (
		<View className="rounded-lg border border-dashed border-border px-4 py-6">
			<MutedText>{message}</MutedText>
		</View>
	);
}

export interface ErrorStateProps {
	readonly message: string;
	readonly retryLabel: string;
	readonly onRetry: () => void;
}

export function ErrorState({ message, retryLabel, onRetry }: ErrorStateProps): React.JSX.Element {
	return (
		<View className="gap-3">
			<Banner tone="error" message={message} />
			<Button label={retryLabel} variant="secondary" onPress={onRetry} />
		</View>
	);
}
