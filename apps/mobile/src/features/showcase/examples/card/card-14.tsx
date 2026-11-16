import { Card } from "@workspace/ui-native/components/card";
import { Icon } from "@workspace/ui-native/components/icon";
import SquareTerminalIcon from "lucide-react-native/icons/square-terminal";
import * as React from "react";
import { Text, View } from "react-native";

interface Stat {
	readonly label: string;
	readonly value: string;
}

const STATS: readonly Stat[] = [
	{ label: "Environment", value: "Production" },
	{ label: "Region", value: "us-east-1" },
	{ label: "Version", value: "v2.4.0" },
	{ label: "Status", value: "Healthy" },
];

/** Every other row is striped. */
const STRIPE_EVERY = 2;

export function Card14Example(): React.JSX.Element {
	return (
		<Card className="overflow-hidden p-0">
			<View className="items-center bg-tone-violet-soft/80 py-12">
				<View className="mb-6 rounded-full bg-tone-violet/10 p-4">
					<Icon icon={SquareTerminalIcon} size="xl" colorClassName="accent-tone-violet" />
				</View>
				<Text className="text-body-lg font-sans-semibold text-foreground">Deployment Successful</Text>
				<Text className="text-label font-sans text-muted-foreground">Your app is now live</Text>
			</View>
			<View className="gap-1 px-4 pb-6">
				{STATS.map((stat: Stat, position: number): React.JSX.Element => (
					<View
						key={stat.label}
						className={position % STRIPE_EVERY === 0 ? "flex-row justify-between rounded-lg bg-muted/40 px-3 py-2.5" : "flex-row justify-between px-3 py-2.5"}>
						<Text className="text-label font-sans-medium text-foreground">{stat.label}</Text>
						<Text className="text-label font-sans text-muted-foreground">{stat.value}</Text>
					</View>
				))}
			</View>
		</Card>
	);
}
