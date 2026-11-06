// The connection and session status in the app drawer, as one line or two small cards (the look chooses,
// features/navigation/drawer-layouts.ts). Each part subscribes to its own slice, so the connection does not
// re-render with every countdown tick. The connection opens its sheet (ping, jitter, packet loss).

import * as React from "react";
import { Pressable, Text, View } from "react-native";

import type { StatusBadgeTone } from "@workspace/ui-native/components/status-badge";
import { useNetworkStatus, useSessionIndicator } from "./facade";
import { sessionPillContent, sessionShortLabel, type StatusPillContent } from "./indicators";
import { networkPillContent, networkShortLabel } from "./network-indicators";
import { NetworkSheet } from "./network-sheet";

/** The small target's extra touch area, so it still reaches 44 pt (rules/04). */
const STATUS_HIT_SLOP = 8;

const DOT_CLASSES: Readonly<Record<StatusBadgeTone, string>> = {
	neutral: "bg-muted-foreground",
	info: "bg-info",
	success: "bg-success",
	warning: "bg-warning",
	destructive: "bg-destructive",
};

function StatusDot({ tone }: { readonly tone: StatusBadgeTone }): React.JSX.Element {
	return <View className={`size-2 rounded-full ${DOT_CLASSES[tone]}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

interface NetworkButtonProps {
	/** What the connection looks like; the button and its sheet are the same everywhere. */
	readonly children: (content: StatusPillContent, shortLabel: string) => React.ReactNode;
	readonly className?: string;
	readonly testID?: string;
}

function NetworkButton({ children, className, testID }: NetworkButtonProps): React.JSX.Element {
	const { reading } = useNetworkStatus();
	const content = networkPillContent(reading);
	const [sheetOpen, setSheetOpen] = React.useState<boolean>(false);
	const openSheet = React.useCallback((): void => {
		setSheetOpen(true);
	}, []);
	const closeSheet = React.useCallback((): void => {
		setSheetOpen(false);
	}, []);
	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={content.accessibilityLabel}
				accessibilityHint="Shows ping, jitter and packet loss"
				onPress={openSheet}
				hitSlop={STATUS_HIT_SLOP}
				className={`active:opacity-70 ${className ?? ""}`}
				testID={testID === undefined ? undefined : `${testID}-button`}>
				{children(content, networkShortLabel(reading))}
			</Pressable>
			<NetworkSheet visible={sheetOpen} onClose={closeSheet} />
		</>
	);
}

export interface StatusLineProps {
	/** On the ink panel rather than the page's colours. */
	readonly onInk: boolean;
	readonly testID?: string;
}

/** The session's half of the line: its own component, so its countdown re-renders alone. */
function SessionText({ className, testID }: { readonly className: string; readonly testID?: string }): React.JSX.Element {
	const indicator = useSessionIndicator();
	return (
		<Text numberOfLines={1} accessibilityLabel={sessionPillContent(indicator).accessibilityLabel} className={className} testID={testID}>
			{sessionShortLabel(indicator)}
		</Text>
	);
}

/** "● Strong, 42 ms · 149m 19s left". */
export function StatusLine({ onInk, testID }: StatusLineProps): React.JSX.Element {
	const textClass = `font-sans text-xs ${onInk ? "text-auth-panel-muted" : "text-muted-foreground"}`;
	return (
		<View className="flex-row items-center gap-1.5" testID={testID}>
			<NetworkButton className="flex-row items-center gap-1.5" {...(testID === undefined ? {} : { testID: `${testID}-network` })}>
				{(content: StatusPillContent): React.ReactNode => (
					<>
						<StatusDot tone={content.tone} />
						<Text numberOfLines={1} className={textClass}>
							{content.label}
						</Text>
					</>
				)}
			</NetworkButton>
			<Text className={textClass} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
				·
			</Text>
			<SessionText className={textClass} {...(testID === undefined ? {} : { testID: `${testID}-session` })} />
		</View>
	);
}

const CARD_CLASS = "flex-1 gap-0.5 rounded-2xl border border-border bg-card px-3 py-2";
const CARD_TITLE_CLASS = "font-sans text-xs text-muted-foreground";
const CARD_VALUE_CLASS = "font-sans-semibold flex-shrink text-sm text-foreground";

export interface StatusCardsProps {
	readonly connectionTitle: string;
	readonly sessionTitle: string;
	readonly testID?: string;
}

/** The connection and the session side by side. */
export function StatusCards({ connectionTitle, sessionTitle, testID }: StatusCardsProps): React.JSX.Element {
	return (
		<View className="flex-row gap-2 px-3.5" testID={testID}>
			<NetworkButton className={CARD_CLASS} {...(testID === undefined ? {} : { testID: `${testID}-network` })}>
				{(content: StatusPillContent, shortLabel: string): React.ReactNode => (
					<>
						<Text className={CARD_TITLE_CLASS}>{connectionTitle}</Text>
						<View className="flex-row items-center gap-1.5">
							<StatusDot tone={content.tone} />
							<Text numberOfLines={1} className={CARD_VALUE_CLASS}>
								{shortLabel}
							</Text>
						</View>
					</>
				)}
			</NetworkButton>
			<View className={CARD_CLASS}>
				<Text className={CARD_TITLE_CLASS}>{sessionTitle}</Text>
				<SessionText className={CARD_VALUE_CLASS} {...(testID === undefined ? {} : { testID: `${testID}-session` })} />
			</View>
		</View>
	);
}
