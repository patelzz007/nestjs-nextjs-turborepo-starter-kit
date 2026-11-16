import { Avatar } from "@workspace/ui-native/components/avatar";
import { Text, View } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

// The approving reviewers as an overlapping stack of avatars.
const REVIEWERS: readonly string[] = ["Alex Johnson", "Sarah Chen", "David Kim"];

const REVIEW = (
	<View className="flex-row items-center justify-between gap-2">
		<View className="flex-row" accessibilityLabel={`Approved by ${REVIEWERS.join(", ")}`}>
			{REVIEWERS.map((name: string, order: number): React.JSX.Element => (
				<Avatar key={name} name={name} imageUrl={null} size="sm" className={order === 0 ? "border-2 border-invert" : "-ml-2 border-2 border-invert"} />
			))}
		</View>
		<Text className="text-caption font-sans text-invert-foreground opacity-70">2m ago</Text>
	</View>
);

export function Sonner17Example(): React.JSX.Element {
	const toast = useToast();
	const shownId = React.useRef<number | null>(null);
	const close = React.useCallback((): void => {
		if (shownId.current !== null) {
			toast.dismissed(shownId.current);
		}
	}, [toast]);
	const merge = React.useCallback((): void => {
		toast.success("Merged successfully");
	}, [toast]);
	const show = React.useCallback((): void => {
		shownId.current = toast.show("default", "All reviewers approved. Ready to merge into main.", {
			title: "Pull Request #284",
			look: "invert",
			content: REVIEW,
			actions: (
				<>
					<Button label="View" size="xs" variant="secondary" onPress={close} />
					<Button label="Merge" size="xs" onPress={merge} />
				</>
			),
		});
	}, [close, merge, toast]);
	return <Button label="PR Merge Toast" variant="outline" onPress={show} className="self-center" />;
}
