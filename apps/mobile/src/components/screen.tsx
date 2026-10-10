// The frame of every screen: safe areas, the theme background, scrolling,
// keyboard avoidance and an optional title.

import * as React from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { useScreenCornerTaken } from "../lib/screen-corner";
import { useTabBarClearance } from "../lib/use-tab-bar-clearance";
import { Heading, MutedText } from "./text";

export interface ScreenProps {
	readonly title?: string;
	readonly description?: string;
	readonly children: React.ReactNode;
	/** Pull to refresh: `refreshing` while the refetch runs. */
	readonly refreshing?: boolean;
	readonly onRefresh?: () => void;
	readonly testID?: string;
}

/**
 * Uniwind maps `className` to `style` only on React Native's own components;
 * a third-party component (here react-native-safe-area-context's view) must be
 * wrapped, or its classes are silently dropped — the frame then has no `flex-1`,
 * collapses to zero height, and the whole screen renders blank.
 */
const StyledSafeAreaView = withUniwind(SafeAreaView);

/** iOS lifts the content above the keyboard by padding; Android resizes the window itself. */
const KEYBOARD_BEHAVIOR = Platform.select<"padding" | undefined>({ ios: "padding", default: undefined });

export function Screen({ title, description, children, refreshing = false, onRefresh, testID }: ScreenProps): React.JSX.Element {
	// Inside the tabs, the floating tab bar covers the bottom of the screen: the content ends above it.
	const tabBarClearance = useTabBarClearance();
	const clearanceStyle = React.useMemo((): { readonly height: number } => ({ height: tabBarClearance }), [tabBarClearance]);
	const scrollIndicatorInsets = React.useMemo((): { readonly bottom: number } => ({ bottom: tabBarClearance }), [tabBarClearance]);
	// A layout's control (the menu button) sits in the top-left corner: the title moves over beside it.
	const cornerTaken = useScreenCornerTaken();

	return (
		<StyledSafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background" testID={testID}>
			<View className="flex-1">
				<KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} className="flex-1">
					<ScrollView
						keyboardShouldPersistTaps="handled"
						scrollIndicatorInsets={scrollIndicatorInsets}
						contentContainerClassName="grow gap-5 px-5 py-6"
						refreshControl={onRefresh === undefined ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
						{title === undefined ? null : (
							<View className="gap-1">
								<View className={cornerTaken ? "min-h-11 justify-center pl-14" : ""}>
									<Heading>{title}</Heading>
								</View>
								{description === undefined ? null : <MutedText>{description}</MutedText>}
							</View>
						)}
						{children}
						{tabBarClearance > 0 ? <View style={clearanceStyle} testID="tab-bar-clearance" /> : null}
					</ScrollView>
				</KeyboardAvoidingView>
			</View>
		</StyledSafeAreaView>
	);
}
