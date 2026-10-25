// The connection and session pills: StatusPills fed by the app status. Each
// subscribes to its own slice, so the connection pill does not re-render with
// every countdown tick. `compact` for the screens' corner, full in the drawer.
// The connection pill opens the connection sheet (ping, jitter, packet loss).

import * as React from "react";
import { Pressable } from "react-native";

import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import { useNetworkStatus, useSessionIndicator } from "./facade";
import { sessionPillContent } from "./indicators";
import { networkPillContent } from "./network-indicators";
import { NetworkSheet } from "./network-sheet";

/** The pill's extra touch area, so the small capsule still reaches 44 pt (rules/04). */
const PILL_HIT_SLOP = 8;

export interface AppStatusPillProps {
	readonly compact: boolean;
	readonly testID?: string;
}

export function NetworkStatusPill({ compact, testID }: AppStatusPillProps): React.JSX.Element {
	const content = networkPillContent(useNetworkStatus().reading, compact);
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
				hitSlop={PILL_HIT_SLOP}
				className="active:opacity-70"
				testID={testID === undefined ? undefined : `${testID}-button`}>
				<StatusBadge {...content} {...(testID === undefined ? {} : { testID })} />
			</Pressable>
			<NetworkSheet visible={sheetOpen} onClose={closeSheet} />
		</>
	);
}

export function SessionStatusPill({ compact, testID }: AppStatusPillProps): React.JSX.Element {
	const content = sessionPillContent(useSessionIndicator(), compact);
	return <StatusBadge {...content} {...(testID === undefined ? {} : { testID })} />;
}
