// The connection sheet the network pill opens: a speedtest-style read-out of
// the last test — what the connection means for the user, its ping, jitter
// and packet loss — and "Test again".

import * as React from "react";
import { Text, View } from "react-native";
import RotateCwIcon from "lucide-react-native/icons/rotate-cw";

import { BottomSheet } from "@workspace/ui-native/components/bottom-sheet";
import { Button } from "@workspace/ui-native/components/button";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { BodyText, MutedText } from "@workspace/ui-native/components/text";
import { useNetworkStatus } from "./facade";
import { networkSheetContent, type NetworkMetric } from "./network-indicators";

function timeOfDay(epochMs: number): string {
	return new Date(epochMs).toLocaleTimeString();
}

function Metric({ metric, first }: { readonly metric: NetworkMetric; readonly first: boolean }): React.JSX.Element {
	return (
		<View
			accessible
			accessibilityLabel={`${metric.label} ${metric.value} ${metric.unit}`}
			className={first ? "flex-1 gap-1 px-3 py-3" : "flex-1 gap-1 border-l border-border px-3 py-3"}>
			<MutedText>{metric.label}</MutedText>
			<View className="flex-row items-baseline gap-0.5">
				<Text className="font-mono text-xl text-foreground">{metric.value}</Text>
				<MutedText>{metric.unit}</MutedText>
			</View>
		</View>
	);
}

export interface NetworkSheetProps {
	readonly visible: boolean;
	readonly onClose: () => void;
}

export function NetworkSheet({ visible, onClose }: NetworkSheetProps): React.JSX.Element {
	const { reading, testing, testAgain } = useNetworkStatus();
	const content = networkSheetContent(reading, timeOfDay);
	return (
		<BottomSheet visible={visible} title="Connection" onClose={onClose} testID="network-sheet">
			<View className="gap-4">
				<View className="flex-row items-start gap-3">
					<IconTile icon={content.icon} tone={content.tone} />
					<View className="flex-1 gap-0.5">
						<BodyText className="font-sans-semibold">{content.headline}</BodyText>
						<MutedText>{content.description}</MutedText>
					</View>
				</View>
				{content.metrics === null ? null : (
					<View className="flex-row rounded-lg border border-border" testID="network-sheet-metrics">
						{content.metrics.map((metric: NetworkMetric, index: number): React.JSX.Element => (
							<Metric key={metric.label} metric={metric} first={index === 0} />
						))}
					</View>
				)}
				<View className="flex-row items-center justify-between gap-3">
					<MutedText className="shrink">{content.lastTest ?? ""}</MutedText>
					<Button
						label={testing ? "Testing…" : "Test again"}
						onPress={testAgain}
						variant="secondary"
						size="sm"
						icon={RotateCwIcon}
						loading={testing}
						disabled={!content.canTest}
						testID="network-sheet-test-again"
					/>
				</View>
			</View>
		</BottomSheet>
	);
}
