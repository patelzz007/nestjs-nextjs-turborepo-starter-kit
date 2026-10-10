// One-tap sign-in buttons for seeded demo accounts — development builds only
// (ADR 042), like the web login pages' "Try demo accounts". Presentational: the
// caller supplies the choices and what choosing one does; it never sees a
// password. A labelled divider sets it apart from the real form.

import * as React from "react";
import { Pressable, Text, View } from "react-native";

export interface QuickSignInChoice {
	/** Stable identity (the account's email). */
	readonly key: string;
	readonly label: string;
}

export interface QuickSignInProps {
	readonly title: string;
	readonly choices: readonly QuickSignInChoice[];
	readonly onSelect: (key: string) => void;
	/** A sign-in is already running: every choice waits. */
	readonly disabled?: boolean;
	readonly testID?: string;
}

export function QuickSignIn({ title, choices, onSelect, disabled = false, testID }: QuickSignInProps): React.JSX.Element {
	return (
		<View className="gap-3" testID={testID}>
			<View className="flex-row items-center gap-3">
				<View className="h-px flex-1 bg-border" />
				<Text accessibilityRole="header" className="font-sans-medium text-sm text-muted-foreground">
					{title}
				</Text>
				<View className="h-px flex-1 bg-border" />
			</View>
			<View className="flex-row flex-wrap gap-2">
				{choices.map((choice: QuickSignInChoice): React.JSX.Element => (
					<QuickSignInButton key={choice.key} choice={choice} onSelect={onSelect} disabled={disabled} />
				))}
			</View>
		</View>
	);
}

interface QuickSignInButtonProps {
	readonly choice: QuickSignInChoice;
	readonly onSelect: (key: string) => void;
	readonly disabled: boolean;
}

function QuickSignInButton({ choice, onSelect, disabled }: QuickSignInButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onSelect(choice.key);
	}, [choice.key, onSelect]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Sign in as ${choice.label}`}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={press}
			className={`min-h-11 grow basis-[46%] items-center justify-center rounded-xl border border-border bg-card px-3 active:bg-muted ${disabled ? "opacity-60" : ""}`}>
			<Text numberOfLines={1} className="font-sans-medium text-sm text-foreground">
				{choice.label}
			</Text>
		</Pressable>
	);
}
