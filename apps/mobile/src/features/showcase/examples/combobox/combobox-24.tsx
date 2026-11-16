import { cn } from "@workspace/ui-native/lib/cn";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { type ComboboxOption, MultiCombobox } from "@workspace/ui-native/components/combobox";
import * as React from "react";
import { Text, View } from "react-native";

const MEMBERS: readonly ComboboxOption<string>[] = [
	{ value: "olivia", label: "Olivia Martin", description: "Product designer", leading: <Avatar name="Olivia Martin" imageUrl={null} size="sm" /> },
	{ value: "jackson", label: "Jackson Lee", description: "Engineering lead", leading: <Avatar name="Jackson Lee" imageUrl={null} size="sm" /> },
	{ value: "isabella", label: "Isabella Nguyen", description: "Data analyst", leading: <Avatar name="Isabella Nguyen" imageUrl={null} size="sm" /> },
	{ value: "william", label: "William Kim", description: "Support engineer", leading: <Avatar name="William Kim" imageUrl={null} size="sm" /> },
	{ value: "sofia", label: "Sofia Davis", description: "Marketing manager", leading: <Avatar name="Sofia Davis" imageUrl={null} size="sm" /> },
	{ value: "liam", label: "Liam Patel", description: "Backend engineer", leading: <Avatar name="Liam Patel" imageUrl={null} size="sm" /> },
];

/** How many avatars the field stacks before it only counts. */
const MAX_STACKED = 4;

/** The chosen people as up to 4 stacked avatars and how many there are. */
function StackedMembers(chosen: readonly ComboboxOption<string>[]): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<View className="flex-row">
				{chosen.slice(0, MAX_STACKED).map((option: ComboboxOption<string>, index: number): React.JSX.Element => (
					<Avatar key={option.value} name={option.label} imageUrl={null} size="sm" className={cn("border-2 border-background", index === 0 ? "" : "-ml-2")} />
				))}
			</View>
			<Text className="text-body-lg font-sans text-foreground">{`${String(chosen.length)} members`}</Text>
		</View>
	);
}

const INITIAL: readonly string[] = ["olivia", "jackson", "isabella", "william", "sofia"];

export function Combobox24Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly string[]>(INITIAL);
	return <MultiCombobox label="Members" options={MEMBERS} values={values} onChange={setValues} placeholder="Add members" renderValues={StackedMembers} />;
}
