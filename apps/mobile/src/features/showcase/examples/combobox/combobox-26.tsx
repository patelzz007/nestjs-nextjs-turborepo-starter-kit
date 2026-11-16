import { cn } from "@workspace/ui-native/lib/cn";
import { type ComboboxOption, MultiCombobox } from "@workspace/ui-native/components/combobox";
import * as React from "react";
import { Text, View } from "react-native";

interface IssueLabel {
	readonly value: string;
	readonly label: string;
	readonly dot: string;
}

const ISSUE_LABELS: readonly IssueLabel[] = [
	{ value: "bug", label: "Bug", dot: "bg-destructive" },
	{ value: "feature", label: "Feature", dot: "bg-tone-violet" },
	{ value: "improvement", label: "Improvement", dot: "bg-info" },
	{ value: "docs", label: "Documentation", dot: "bg-success" },
	{ value: "design", label: "Design", dot: "bg-tone-orange" },
];

const OPTIONS: readonly ComboboxOption<string>[] = ISSUE_LABELS.map((issueLabel: IssueLabel): ComboboxOption<string> => ({
	value: issueLabel.value,
	label: issueLabel.label,
	leading: <View className={cn("size-2.5 rounded-full", issueLabel.dot)} />,
}));

/** How many dots the field shows before it counts the rest. */
const MAX_DOTS = 3;

/** One label's name, or up to 3 dots and a count of the rest. */
function LabelSummary(chosen: readonly ComboboxOption<string>[]): React.JSX.Element {
	const [only] = chosen;
	if (chosen.length === 1 && only !== undefined) {
		return <Text className="text-body-lg font-sans text-foreground">{only.label}</Text>;
	}
	const rest = chosen.length - MAX_DOTS;
	return (
		<View className="flex-row items-center gap-1">
			{chosen.slice(0, MAX_DOTS).map((option: ComboboxOption<string>): React.JSX.Element => (
				<View key={option.value} className={cn("size-2.5 rounded-full", ISSUE_LABELS.find((item: IssueLabel): boolean => item.value === option.value)?.dot)} />
			))}
			<Text className="text-body-lg font-sans text-foreground">{rest > 0 ? `+${String(rest)} labels` : `${String(chosen.length)} labels`}</Text>
		</View>
	);
}

const INITIAL: readonly string[] = ["bug", "feature", "improvement", "docs"];

export function Combobox26Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly string[]>(INITIAL);
	return <MultiCombobox label="Labels" options={OPTIONS} values={values} onChange={setValues} placeholder="No labels" renderValues={LabelSummary} />;
}
