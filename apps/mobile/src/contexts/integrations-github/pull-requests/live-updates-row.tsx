// Live updates of the pull request's repository, in one row under its header:
// "Live" with a breathing dot while changes on GitHub arrive by themselves
// (with "Turn off"), "Reconnecting…" while the stream is re-opening, or "Live
// updates are off" with "Turn on". Nothing at all when the server has no live
// updates. Presentational: the screen passes the hook's state.

import * as React from "react";
import { Text, View } from "react-native";

import { Button } from "@workspace/ui-native/components/button";
import { PulseDot } from "@workspace/ui-native/components/pulse-dot";
import type { PullRequestLiveUpdates } from "./use-pull-request-live-updates";

export const LIVE_UPDATES_ON_DETAIL = "Changes on GitHub show here as they happen.";
export const LIVE_UPDATES_RECONNECTING_DETAIL = "Reconnecting… pull to refresh in the meantime.";
export const LIVE_UPDATES_OFF_DETAIL = "Turn them on to see changes without refreshing.";

export interface LiveUpdatesRowProps {
	readonly liveUpdates: PullRequestLiveUpdates;
}

export function LiveUpdatesRow({ liveUpdates }: LiveUpdatesRowProps): React.JSX.Element | null {
	if (liveUpdates.status === "unavailable" || liveUpdates.status === "loading") {
		return null;
	}
	const on = liveUpdates.status === "enabled";
	const reconnecting = on && liveUpdates.connection === "reconnecting";
	return (
		<View
			accessible
			accessibilityLabel={
				on ? `Live updates on. ${reconnecting ? LIVE_UPDATES_RECONNECTING_DETAIL : LIVE_UPDATES_ON_DETAIL}` : `Live updates are off. ${LIVE_UPDATES_OFF_DETAIL}`
			}
			className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
			testID="pull-request-live-updates">
			{on ? (
				<PulseDot className={`size-2.5 rounded-full ${reconnecting ? "bg-warning" : "bg-success"}`} />
			) : (
				<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="size-2.5 rounded-full bg-muted-foreground opacity-40" />
			)}
			<View className="flex-1 gap-0.5" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
				<Text className="font-sans-semibold text-sm text-foreground">{on ? "Live" : "Live updates are off"}</Text>
				<Text className="font-sans text-sm text-muted-foreground">
					{on ? (reconnecting ? LIVE_UPDATES_RECONNECTING_DETAIL : LIVE_UPDATES_ON_DETAIL) : LIVE_UPDATES_OFF_DETAIL}
				</Text>
			</View>
			<Button
				label={on ? "Turn off" : "Turn on"}
				size="sm"
				variant="secondary"
				loading={liveUpdates.isChanging}
				onPress={on ? liveUpdates.turnOff : liveUpdates.turnOn}
				accessibilityLabel={on ? "Turn live updates off" : "Turn live updates on"}
				accessibilityHint={on ? "Stops changes on GitHub from showing here by themselves" : "Registers a webhook on the repository with your GitHub token"}
				testID="pull-request-live-updates-toggle"
			/>
		</View>
	);
}
