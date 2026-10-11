// The frame of every screen: safe areas, the theme background, scrolling,
// keyboard avoidance and an optional title.
//
// Inside the app shell (ADR 046) the page header is laid over the top of the
// screen: the content starts below it, and the header — not the screen — shows
// the title (it comes from the route, features/navigation/app-screens.ts), so
// a screen there passes no `title`. Outside it (the lock screen, a forced
// update) the screen draws its own title at the top of the content.

import * as React from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { usePageHeaderClearance } from "../lib/page-header-clearance";
import { useTabBarClearance } from "../lib/use-tab-bar-clearance";
import { Heading, MutedText } from "./text";

export interface ScreenProps {
	/** Drawn at the top of the content outside the app shell; inside it the header shows the route's title instead. */
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
	// Inside the app shell the header covers the top (status bar included): the content starts below it.
	const headerClearance = usePageHeaderClearance();
	const hasHeader = headerClearance !== null;
	const headerClearanceStyle = React.useMemo(
		(): { readonly paddingTop: number } | undefined => (headerClearance === null ? undefined : { paddingTop: headerClearance }),
		[headerClearance],
	);
	const scrollIndicatorInsets = React.useMemo(
		(): { readonly top: number; readonly bottom: number } => ({ top: headerClearance ?? 0, bottom: tabBarClearance }),
		[headerClearance, tabBarClearance],
	);
	const showTitle = title !== undefined && !hasHeader;

	return (
		<StyledSafeAreaView edges={hasHeader ? ["left", "right"] : ["top", "left", "right"]} className="flex-1 bg-background" testID={testID}>
			<View className="flex-1">
				<KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} className="flex-1">
					<ScrollView
						testID={testID === undefined ? undefined : `${testID}-content`}
						keyboardShouldPersistTaps="handled"
						scrollIndicatorInsets={scrollIndicatorInsets}
						contentContainerClassName="grow gap-5 px-5 py-6"
						contentContainerStyle={headerClearanceStyle}
						refreshControl={onRefresh === undefined ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
						{showTitle || description !== undefined ? (
							<View className="gap-1">
								{showTitle ? <Heading>{title}</Heading> : null}
								{description === undefined ? null : <MutedText>{description}</MutedText>}
							</View>
						) : null}
						{children}
						{tabBarClearance > 0 ? <View style={clearanceStyle} testID="tab-bar-clearance" /> : null}
					</ScrollView>
				</KeyboardAvoidingView>
			</View>
		</StyledSafeAreaView>
	);
}
