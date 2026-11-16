import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";
import { Text, View } from "react-native";

const TITLE = "Usage this month";

export function Collapsible4Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setOpen((value: boolean): boolean => !value);
	}, []);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
			</CardHeader>
			<CardContent className="gap-3">
				<Progress value={68} accessibilityLabel="Usage" valueText="$34 of $50" />
				<Text className="text-body font-sans text-muted-foreground">$34 of your $50 budget</Text>
				{open ? (
					<View className="gap-1">
						<Text className="text-body font-sans text-foreground">Compute — $21</Text>
						<Text className="text-body font-sans text-foreground">Storage — $8</Text>
						<Text className="text-body font-sans text-foreground">Bandwidth — $5</Text>
					</View>
				) : null}
				<IconButton
					icon={open ? ChevronUpIcon : ChevronDownIcon}
					label={open ? "Hide the breakdown" : "Show the breakdown"}
					variant="secondary"
					size="sm"
					onPress={toggle}
					className="-mb-8 self-center rounded-full"
				/>
			</CardContent>
		</Card>
	);
}
