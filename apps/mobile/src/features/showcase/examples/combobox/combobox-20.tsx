import { Avatar } from "@workspace/ui-native/components/avatar";
import { type ComboboxOption, MultiCombobox } from "@workspace/ui-native/components/combobox";
import * as React from "react";

const MEMBERS: readonly ComboboxOption<string>[] = [
	{ value: "olivia", label: "Olivia Martin", description: "Product designer", leading: <Avatar name="Olivia Martin" imageUrl={null} size="sm" /> },
	{ value: "jackson", label: "Jackson Lee", description: "Engineering lead", leading: <Avatar name="Jackson Lee" imageUrl={null} size="sm" /> },
	{ value: "isabella", label: "Isabella Nguyen", description: "Data analyst", leading: <Avatar name="Isabella Nguyen" imageUrl={null} size="sm" /> },
	{ value: "william", label: "William Kim", description: "Support engineer", leading: <Avatar name="William Kim" imageUrl={null} size="sm" /> },
	{ value: "sofia", label: "Sofia Davis", description: "Marketing manager", leading: <Avatar name="Sofia Davis" imageUrl={null} size="sm" /> },
	{ value: "liam", label: "Liam Patel", description: "Backend engineer", leading: <Avatar name="Liam Patel" imageUrl={null} size="sm" /> },
];

const INITIAL: readonly string[] = ["isabella", "william"];

export function Combobox20Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly string[]>(INITIAL);
	return <MultiCombobox label="Members" options={MEMBERS} values={values} onChange={setValues} placeholder="Add members" variant="ghost" />;
}
