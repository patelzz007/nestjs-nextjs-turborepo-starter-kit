// The frame of every screen: safe areas, the theme background, scrolling,
// keyboard avoidance and an optional title.
//
// Inside the app shell (ADR 046) the page header is laid over the top of the
// screen: the content starts below it, on a sheet with a curved top (the auth
// pages' curve), and the header — not the screen — shows the title (it comes
// from the route, features/navigation/app-screens.ts), so a screen there passes
// no `title`. The screen feeds the header its scrolling, so the header collapses
// with the content (src/lib/page-header-scroll.tsx). Outside it (the lock
// screen, a forced update) the screen draws its own title at the top of the content.
//
// The scroll view starts below the header's pinned row (menu, title, notifications), which never
// moves, and keeps only the subtitle line's height as padding: the content scrolls up under the
// collapsing part of the header and is clipped at the pinned row. So the scrollbar runs along the
// content, not from the top of the screen — Android has no scroll indicator insets to move it
// (`scrollIndicatorInsets` is iOS-only).

import * as React from "react";
import { RefreshControl, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { KeyboardAvoidingView } from "@workspace/ui-native/components/keyboard-avoiding-view";

import { pageHeaderControlsBottom } from "./page-header";
import { usePageHeaderClearance } from "../lib/page-header-clearance";
import { usePageHeaderScrollHandler } from "../lib/page-header-scroll";
import { useKeyboardVisible } from "../lib/use-keyboard-visible";
import { useTabBarClearance } from "../lib/use-tab-bar-clearance";
import { Heading, MutedText } from "@workspace/ui-native/components/text";

export interface ScreenProps {
	/** Drawn at the top of the content outside the app shell; inside it the header shows the route's title instead. */
	readonly title?: string;
	readonly description?: string;
	readonly children: React.ReactNode;
	/** Pull to refresh: `refreshing` while the refetch runs. */
	readonly refreshing?: boolean;
	readonly onRefresh?: () => void;
	/**
	 * `false`: the content fills the screen below the header without scrolling —
	 * for a screen whose content scrolls itself (a document viewer's page list),
	 * so there is never a scroll view inside a scroll view. Default `true`.
	 */
	readonly scrollable?: boolean;
	readonly testID?: string;
}

/**
 * Uniwind maps `className` to `style` only on React Native's own components;
 * a third-party component (here react-native-safe-area-context's view) must be
 * wrapped, or its classes are silently dropped — the frame then has no `flex-1`,
 * collapses to zero height, and the whole screen renders blank.
 */
const StyledSafeAreaView = withUniwind(SafeAreaView);
/** Reanimated's scroll view, so the page header can follow the scrolling on the UI thread (wrapped, or its classes are dropped). */
const StyledScrollView = withUniwind(Animated.ScrollView);

/** How often the scroll view reports its position, in ms: once a frame, so the header follows finger for finger. */
const SCROLL_EVENT_THROTTLE_MS = 16;

export function Screen({ title, description, children, refreshing = false, onRefresh, scrollable = true, testID }: ScreenProps): React.JSX.Element {
	// Inside the tabs, the floating tab bar covers the bottom of the screen: the content ends above it.
	const barClearance = useTabBarClearance();
	// While the keyboard is up it covers the tab bar: the room kept for the bar would only be empty space above the keyboard.
	const keyboardVisible = useKeyboardVisible();
	const tabBarClearance = keyboardVisible ? 0 : barClearance;
	const clearanceStyle = React.useMemo((): { readonly height: number } => ({ height: tabBarClearance }), [tabBarClearance]);
	// Inside the app shell the header covers the top (status bar included): the content starts below it.
	const headerClearance = usePageHeaderClearance();
	const onScroll = usePageHeaderScrollHandler();
	const hasHeader = headerClearance !== null;
	const headerClearanceStyle = React.useMemo(
		(): { readonly paddingTop: number } | undefined => (headerClearance === null ? undefined : { paddingTop: headerClearance }),
		[headerClearance],
	);
	// A scrolling screen starts below the header's pinned row; only the collapsing subtitle line is padding inside it.
	const insets = useSafeAreaInsets();
	const scrollTop = headerClearance === null ? 0 : pageHeaderControlsBottom(insets.top);
	const scrollPaddingTop = headerClearance === null ? 0 : Math.max(headerClearance - scrollTop, 0);
	const scrollFrameStyle = React.useMemo((): { readonly marginTop: number } => ({ marginTop: scrollTop }), [scrollTop]);
	const scrollContentStyle = React.useMemo(
		(): { readonly paddingTop: number } | undefined => (headerClearance === null ? undefined : { paddingTop: scrollPaddingTop }),
		[headerClearance, scrollPaddingTop],
	);
	const scrollIndicatorInsets = React.useMemo(
		(): { readonly top: number; readonly bottom: number } => ({ top: scrollPaddingTop, bottom: tabBarClearance }),
		[scrollPaddingTop, tabBarClearance],
	);
	const showTitle = title !== undefined && !hasHeader;

	const content = (
		<>
			{showTitle || description !== undefined ? (
				<View className="gap-1">
					{showTitle ? <Heading>{title}</Heading> : null}
					{description === undefined ? null : <MutedText>{description}</MutedText>}
				</View>
			) : null}
			{children}
			{tabBarClearance > 0 ? <View style={clearanceStyle} testID="tab-bar-clearance" /> : null}
		</>
	);
	// Inside the shell the content sits on a sheet with a curved top, right under the header — the
	// same curve as the auth pages'. Outside it, the content sits on the page.
	const page = hasHeader ? (
		<View className="grow gap-5 rounded-t-4xl bg-card px-5 py-6" testID={testID === undefined ? undefined : `${testID}-sheet`}>
			{content}
		</View>
	) : (
		content
	);

	return (
		<StyledSafeAreaView edges={hasHeader ? ["left", "right"] : ["top", "left", "right"]} className="flex-1 bg-background" testID={testID}>
			<View className="flex-1">
				<KeyboardAvoidingView className="flex-1">
					{scrollable ? (
						<StyledScrollView
							onScroll={onScroll}
							style={scrollFrameStyle}
							scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
							testID={testID === undefined ? undefined : `${testID}-content`}
							keyboardShouldPersistTaps="handled"
							scrollIndicatorInsets={scrollIndicatorInsets}
							contentContainerClassName={hasHeader ? "grow" : "grow gap-5 px-5 py-6"}
							contentContainerStyle={scrollContentStyle}
							refreshControl={
								onRefresh === undefined ? undefined : (
									<RefreshControl
										refreshing={refreshing}
										onRefresh={onRefresh}
										// The spinner sits at the scroll view's top edge, not after the content's padding: under the shell's header it would be hidden. It drops to where the content starts.
										{...(headerClearance === null ? {} : { progressViewOffset: scrollPaddingTop })}
									/>
								)
							}>
							{page}
						</StyledScrollView>
					) : (
						<View testID={testID === undefined ? undefined : `${testID}-content`} className={hasHeader ? "flex-1" : "flex-1 gap-5 px-5 py-6"} style={headerClearanceStyle}>
							{page}
						</View>
					)}
				</KeyboardAvoidingView>
			</View>
		</StyledSafeAreaView>
	);
}
