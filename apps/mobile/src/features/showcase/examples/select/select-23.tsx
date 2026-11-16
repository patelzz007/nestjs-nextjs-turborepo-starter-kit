import { cn } from "@workspace/ui-native/lib/cn";
import { MultiSelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";
import { Text, View } from "react-native";

interface Deployment {
	readonly value: string;
	readonly label: string;
	readonly dot: string;
}

const DEPLOYMENTS: readonly Deployment[] = [
	{ value: "ready", label: "Ready", dot: "bg-success" },
	{ value: "building", label: "Building", dot: "bg-warning" },
	{ value: "queued", label: "Queued", dot: "bg-info" },
	{ value: "error", label: "Error", dot: "bg-destructive" },
	{ value: "canceled", label: "Canceled", dot: "bg-muted-foreground" },
];

const OPTIONS: readonly SelectOption<string>[] = DEPLOYMENTS.map((deployment: Deployment): SelectOption<string> => ({
	value: deployment.value,
	label: deployment.label,
	leading: <View className={cn("size-2 rounded-full", deployment.dot)} />,
}));

/** The chosen statuses as overlapping dots, then how many. */
function OverlappingDots(chosen: readonly SelectOption<string>[]): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<View className="flex-row">
				{chosen.map((option: SelectOption<string>, index: number): React.JSX.Element => (
					<View
						key={option.value}
						className={cn(
							"size-3 rounded-full border-2 border-background",
							index === 0 ? "" : "-ml-1",
							DEPLOYMENTS.find((deployment: Deployment): boolean => deployment.value === option.value)?.dot,
						)}
					/>
				))}
			</View>
			<Text className="text-body-lg font-sans text-foreground">{`${String(chosen.length)} selected`}</Text>
		</View>
	);
}

const INITIAL: readonly string[] = ["ready", "building"];

export function Select23Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly string[]>(INITIAL);
	return <MultiSelectField label="Statuses" options={OPTIONS} values={values} onChange={setValues} renderValues={OverlappingDots} placeholder="Select statuses" />;
}
