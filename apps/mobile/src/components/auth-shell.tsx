// The frame around every signed-out screen (ADR 039): the brand on the dark
// auth panel — the web sign-in's panel, from the same `auth-*` tokens — and a
// rounded sheet below it that holds the screens. Presentational: the caller
// gives the brand and the content (the (auth) stack).
//
//   ┌──────────────────────────┐
//   │          ╭───╮•          │   auth panel (dark in both themes): the
//   │          │ ▣ │           │   brand mark's tile, name and tagline, centred —
//   │          ╰───╯           │   the web sign-in panel's composition
//   │        Reward Hub        │
//   │   Sign in to pick up…    │
//   ╭──────────────────────────╮
//   │  Welcome back            │   sheet: the screen (AuthPage), sized to
//   │  [ Email            ]    │   its form rather than the whole screen
//   │  [ Password       👁 ]    │
//
// While the keyboard is open the brand folds into one compact row, giving the
// form the room.

import * as React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { BrandMark } from "./brand-mark";
import { PulseDot } from "./pulse-dot";

/** Side of the brand mark on the large tile and on the compact one, in points. */
const MARK_SIZE = 40;
const COMPACT_MARK_SIZE = 22;

/** react-native-safe-area-context's view, with Uniwind's `className` (see screen.tsx). */
const StyledSafeAreaView = withUniwind(SafeAreaView);

export interface AuthShellProps {
	readonly brandName: string;
	/** One line under the brand name. */
	readonly tagline: string;
	/** Folds the brand into one compact row to give the form room (while the keyboard is open). */
	readonly compact?: boolean;
	/** The screens. */
	readonly children: React.ReactNode;
	readonly testID?: string;
}

export function AuthShell({ brandName, tagline, compact = false, children, testID }: AuthShellProps): React.JSX.Element {
	return (
		<StyledSafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-auth-panel" testID={testID}>
			{/* Quiet outlines echo the web panel's decoration; decorative only. */}
			<View
				className="absolute top-10 -right-6 size-28 rotate-45 rounded-3xl border border-auth-panel-foreground/10"
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			/>
			<View
				className="absolute top-36 right-24 size-8 rotate-12 rounded-lg border border-auth-panel-foreground/10"
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			/>
			{compact ? (
				<View className="flex-row items-center gap-3 px-6 pt-3 pb-5" testID={testID === undefined ? undefined : `${testID}-brand-compact`}>
					<View className="size-10 items-center justify-center rounded-xl bg-auth-brand-from">
						<BrandMark size={COMPACT_MARK_SIZE} colorClassName="accent-auth-panel-foreground" />
					</View>
					<Text accessibilityRole="header" className="font-heading text-xl text-auth-panel-foreground">
						{brandName}
					</Text>
				</View>
			) : (
				<View className="items-center gap-2 px-8 pt-10 pb-12" testID={testID === undefined ? undefined : `${testID}-brand`}>
					<View className="mb-4">
						<View className="size-20 items-center justify-center rounded-3xl border border-auth-panel-foreground/10 bg-auth-brand-from shadow-2xl">
							<BrandMark size={MARK_SIZE} colorClassName="accent-auth-panel-foreground" />
						</View>
						{/* The web panel's status dot — pulsing the same way — ringed in the panel colour so it sits on the tile's corner. */}
						<PulseDot
							className="absolute -top-1.5 -right-1.5 size-5 rounded-full border-3 border-auth-panel bg-success"
							testID={testID === undefined ? undefined : `${testID}-status-dot`}
						/>
					</View>
					<Text accessibilityRole="header" className="font-heading text-3xl text-auth-panel-foreground">
						{brandName}
					</Text>
					<Text className="max-w-xs text-center font-sans text-base text-auth-panel-muted">{tagline}</Text>
				</View>
			)}
			<View className="flex-1 overflow-hidden rounded-t-4xl bg-card">{children}</View>
		</StyledSafeAreaView>
	);
}
