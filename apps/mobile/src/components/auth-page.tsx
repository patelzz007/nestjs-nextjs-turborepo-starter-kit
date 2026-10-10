// One signed-out screen inside the AuthShell's sheet (ADR 039): a title, an
// optional line under it, the form, and an optional footer (the "Don't have an
// account?" line) pinned to the bottom. Presentational — the screen supplies
// only its words and its form; spacing, scrolling, the keyboard and the safe
// area are handled here, the same way on every auth screen.

import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

/** react-native-safe-area-context's view, with Uniwind's `className` (see screen.tsx). */
const StyledSafeAreaView = withUniwind(SafeAreaView);

/** iOS lifts the content above the keyboard by padding; Android resizes the window itself. */
const KEYBOARD_BEHAVIOR = Platform.select<"padding" | undefined>({ ios: "padding", default: undefined });

export interface AuthPageProps {
	readonly title: string;
	readonly description?: string;
	/** The form: fields, notices and actions. */
	readonly children: React.ReactNode;
	/** A line pinned to the bottom of the sheet ("Don't have an account? Create one"). */
	readonly footer?: React.ReactNode;
	readonly testID?: string;
}

export function AuthPage({ title, description, children, footer, testID }: AuthPageProps): React.JSX.Element {
	return (
		<StyledSafeAreaView edges={["bottom", "left", "right"]} className="flex-1 bg-card" testID={testID}>
			<KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} className="flex-1">
				<ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow gap-6 px-6 pt-7 pb-6">
					<View className="gap-2">
						<Text accessibilityRole="header" className="font-heading text-3xl text-foreground">
							{title}
						</Text>
						{description === undefined ? null : <Text className="font-sans text-base text-muted-foreground">{description}</Text>}
					</View>
					<View className="gap-4">{children}</View>
					{footer === undefined ? null : <View className="mt-auto items-center pt-4">{footer}</View>}
				</ScrollView>
			</KeyboardAvoidingView>
		</StyledSafeAreaView>
	);
}
