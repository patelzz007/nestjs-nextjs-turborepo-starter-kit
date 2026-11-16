import { Icon } from "@workspace/ui-native/components/icon";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui-native/components/marker";
import CheckIcon from "lucide-react-native/icons/check";
import FileTextIcon from "lucide-react-native/icons/file-text";
import GitMergeIcon from "lucide-react-native/icons/git-merge";
import RotateCcwIcon from "lucide-react-native/icons/rotate-ccw";
import * as React from "react";
import { AccessibilityInfo, View } from "react-native";

import { ignorePress } from "../example-support";

const REVIEW = "Review pull request #412";
const DIFF = "Open the diff for rate-limit.ts";

// Two lines that are links, and one that is a button toggling real state: the line rewrites itself, and the change is announced.
export function Marker6Example(): React.JSX.Element {
	const [reverted, setReverted] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setReverted((current: boolean): boolean => {
			AccessibilityInfo.announceForAccessibility(current ? "Revert undone" : "Change reverted");
			return !current;
		});
	}, []);
	const action = reverted ? "Undo the revert" : "Revert this change";
	return (
		<View className="gap-4">
			<Marker onPress={ignorePress} accessibilityLabel={REVIEW}>
				<MarkerIcon>
					<Icon icon={GitMergeIcon} size="sm" colorClassName="accent-muted-foreground" />
				</MarkerIcon>
				<MarkerContent>{REVIEW}</MarkerContent>
			</Marker>
			<Marker onPress={ignorePress} accessibilityLabel={DIFF}>
				<MarkerIcon>
					<Icon icon={FileTextIcon} size="sm" colorClassName="accent-muted-foreground" />
				</MarkerIcon>
				<MarkerContent>{DIFF}</MarkerContent>
			</Marker>
			<Marker onPress={toggle} accessibilityLabel={action} accessibilityRole="button">
				<MarkerIcon>
					<Icon icon={reverted ? CheckIcon : RotateCcwIcon} size="sm" colorClassName="accent-muted-foreground" />
				</MarkerIcon>
				<MarkerContent>{action}</MarkerContent>
			</Marker>
		</View>
	);
}
