import { Avatar } from "@workspace/ui-native/components/avatar";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import * as React from "react";

const MEMBERS: readonly ComboboxOption<string>[] = [
	{ value: "olivia", label: "Olivia Martin", description: "Product designer", leading: <Avatar name="Olivia Martin" imageUrl={null} size="sm" /> },
	{ value: "jackson", label: "Jackson Lee", description: "Engineering lead", leading: <Avatar name="Jackson Lee" imageUrl={null} size="sm" /> },
	{ value: "isabella", label: "Isabella Nguyen", description: "Data analyst", leading: <Avatar name="Isabella Nguyen" imageUrl={null} size="sm" /> },
	{ value: "william", label: "William Kim", description: "Support engineer", leading: <Avatar name="William Kim" imageUrl={null} size="sm" /> },
	{ value: "sofia", label: "Sofia Davis", description: "Marketing manager", leading: <Avatar name="Sofia Davis" imageUrl={null} size="sm" /> },
];

export function Combobox16Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <Combobox label="Member" options={MEMBERS} value={value} onChange={setValue} placeholder="Select a member" />;
}
