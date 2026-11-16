import { Bubble } from "@workspace/ui-native/components/bubble";
import { Button } from "@workspace/ui-native/components/button";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import * as React from "react";
import { Text, View } from "react-native";

const LEAD = "Your plan renews on 1 December at the same price.";
const MORE: readonly string[] = [
	"Seats you added mid-cycle are prorated on this invoice.",
	"Annual billing would save 18% from the next renewal.",
	"You can change plans any time before the renewal date.",
];

// A long reply that leads with one line and opens the rest on request; the button's chevron turns with it.
export function Bubble5Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setOpen((current: boolean): boolean => !current);
	}, []);
	return (
		<Bubble>
			<Text className="text-body-lg font-sans text-foreground">{LEAD}</Text>
			{open ? (
				<View className="gap-1.5">
					{MORE.map((line: string): React.JSX.Element => (
						<Text key={line} className="text-body font-sans text-foreground">
							{line}
						</Text>
					))}
				</View>
			) : null}
			<Button
				label={open ? "Show less" : "Show more"}
				icon={open ? ChevronUpIcon : ChevronDownIcon}
				iconPosition="end"
				variant="link"
				size="xs"
				onPress={toggle}
				className="self-start"
			/>
		</Bubble>
	);
}
