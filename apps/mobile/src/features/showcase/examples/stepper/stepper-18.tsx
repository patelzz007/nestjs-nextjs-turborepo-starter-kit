import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

const STAGES: readonly { readonly key: string; readonly title: string; readonly rows: readonly { readonly label: string; readonly value: string }[] }[] = [
	{
		key: "lead",
		title: "Lead",
		rows: [
			{ label: "Source", value: "Website" },
			{ label: "Owner", value: "Ava" },
		],
	},
	{
		key: "qualified",
		title: "Qualified",
		rows: [
			{ label: "Budget", value: "$40k" },
			{ label: "Timeline", value: "Q1" },
		],
	},
	{
		key: "proposal",
		title: "Proposal",
		rows: [
			{ label: "Sent", value: "12 Nov" },
			{ label: "Value", value: "$38k" },
		],
	},
	{ key: "won", title: "Won", rows: [{ label: "Signed", value: "—" }] },
];
const STEPS: readonly StepperStep[] = STAGES.map((stage): StepperStep => ({ key: stage.key, title: stage.title }));

export function Stepper18Example(): React.JSX.Element {
	const [step, setStep] = React.useState(3);
	return (
		<View className="gap-3">
			<Stepper steps={STEPS} value={step} onChange={setStep} />
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
				{STAGES.map((stage): React.JSX.Element => (
					<View key={stage.key} className="rounded-card w-44 gap-1 border border-border bg-card p-3">
						<Text className="text-body font-sans-semibold text-foreground">{stage.title}</Text>
						{stage.rows.map((row): React.JSX.Element => (
							<View key={row.label} className="flex-row justify-between">
								<Text className="text-caption font-sans text-muted-foreground">{row.label}</Text>
								<Text className="text-caption font-sans-medium text-foreground">{row.value}</Text>
							</View>
						))}
					</View>
				))}
			</ScrollView>
		</View>
	);
}
