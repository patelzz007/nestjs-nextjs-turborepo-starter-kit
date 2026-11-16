import { Progress } from "@workspace/ui-native/components/progress";
import { Icon } from "@workspace/ui-native/components/icon";
import CircleIcon from "lucide-react-native/icons/circle";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import * as React from "react";
import { Text, View } from "react-native";

interface SetupStep {
	readonly label: string;
	readonly completed: boolean;
}

const STEPS: readonly SetupStep[] = [
	{ label: "Account", completed: true },
	{ label: "Profile", completed: true },
	{ label: "Preferences", completed: false },
	{ label: "Review", completed: false },
];
const COMPLETED = STEPS.filter((step: SetupStep): boolean => step.completed).length;

export function Progress7Example(): React.JSX.Element {
	return (
		<View className="gap-4">
			<Progress
				value={COMPLETED}
				max={STEPS.length}
				label="Setup Progress"
				showValue
				valueText={`${String(COMPLETED)} of ${String(STEPS.length)} steps`}
				accessibilityLabel="Setup progress"
			/>
			<View className="gap-2">
				{STEPS.map((step: SetupStep): React.JSX.Element => (
					<View key={step.label} className="flex-row items-center gap-2">
						<Icon icon={step.completed ? CircleCheckIcon : CircleIcon} size="sm" colorClassName={step.completed ? "accent-success" : "accent-muted-foreground"} />
						<Text className={step.completed ? "text-label font-sans text-foreground" : "text-label font-sans text-muted-foreground"}>{step.label}</Text>
					</View>
				))}
			</View>
		</View>
	);
}
