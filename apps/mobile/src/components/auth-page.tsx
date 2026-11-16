// One signed-out screen inside the AuthShell's sheet (ADR 039): a title, an
// optional line under it, the form, and an optional footer (the "Don't have an
// account?" line) pinned to the bottom. Presentational — the screen supplies
// only its words and its form; spacing, scrolling, the keyboard and the safe
// area are handled here, the same way on every auth screen.

import * as React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { KeyboardAvoidingView } from "@workspace/ui-native/components/keyboard-avoiding-view";
import { FieldSurfaceProvider } from "@workspace/ui-native/lib/field-surface";

/** react-native-safe-area-context's view, with Uniwind's `className` (see screen.tsx). */
const StyledSafeAreaView = withUniwind(SafeAreaView);

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
			<KeyboardAvoidingView className="flex-1">
				<ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow gap-6 px-6 pt-7 pb-6">
					<View className="gap-2">
						<Text accessibilityRole="header" className="text-h1 font-heading text-foreground">
							{title}
						</Text>
						{description === undefined ? null : <Text className="text-body-lg font-sans text-muted-foreground">{description}</Text>}
					</View>
					{/* The sheet is the card colour, so its fields take the card's fill. */}
					<View className="gap-4">
						<FieldSurfaceProvider surface="card">{children}</FieldSurfaceProvider>
					</View>
					{footer === undefined ? null : <View className="mt-auto items-center pt-4">{footer}</View>}
				</ScrollView>
			</KeyboardAvoidingView>
		</StyledSafeAreaView>
	);
}
