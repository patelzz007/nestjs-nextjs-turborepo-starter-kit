import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Progress } from "@workspace/ui-native/components/progress";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "3 days remaining in cycle";

interface Charge {
	readonly label: string;
	readonly amount: string;
}

const CHARGES: readonly Charge[] = [
	{ label: "Requests", amount: "$210.84" },
	{ label: "Active CPU", amount: "$21.95" },
	{ label: "Events", amount: "$21.20" },
	{ label: "Storage Usage", amount: "$20.45" },
	{ label: "Bandwidth", amount: "$0.00" },
];

/** Rows shown while folded; the rest wait behind the toggle. */
const FOLDED_ROWS = 2;
/** The plan's credit used, in percent. */
const CREDIT_USED_PERCENT = 90;

export function Card13Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setOpen((current: boolean): boolean => !current);
	}, []);
	const shown = open ? CHARGES : CHARGES.slice(0, FOLDED_ROWS);
	return (
		<Card className="pb-8">
			<CardHeader className="flex-row items-center justify-between">
				<CardTitle>{TITLE}</CardTitle>
				<Button label="Billing" variant="outline" size="sm" onPress={ignorePress} />
			</CardHeader>
			<CardContent className="gap-5">
				<View className="gap-3 rounded-lg bg-muted/60 p-4">
					<View className="flex-row justify-between">
						<Text className="text-caption font-sans-medium text-muted-foreground">Included Credit</Text>
						<Text className="text-caption font-sans-medium text-muted-foreground">On-Demand Charges</Text>
					</View>
					<View className="flex-row justify-between">
						<Text className="text-body-lg font-sans-bold text-foreground">$18.08 / $20</Text>
						<Text className="text-body-lg font-sans-bold text-foreground">$0</Text>
					</View>
					<Progress value={CREDIT_USED_PERCENT} size="lg" accessibilityLabel="Included credit used" />
				</View>
				<View className="gap-4">
					{shown.map((charge: Charge): React.JSX.Element => (
						<View key={charge.label} className="flex-row justify-between">
							<Text className="text-label font-sans-medium text-foreground">{charge.label}</Text>
							<Text className="text-label font-sans text-muted-foreground">{charge.amount}</Text>
						</View>
					))}
				</View>
			</CardContent>
			<View className="absolute -bottom-4 self-center">
				<IconButton
					icon={open ? ChevronUpIcon : ChevronDownIcon}
					label={open ? "Show fewer charges" : "Show every charge"}
					variant="secondary"
					size="sm"
					onPress={toggle}
					className="rounded-full border border-border bg-background shadow-sm"
				/>
			</View>
		</Card>
	);
}
