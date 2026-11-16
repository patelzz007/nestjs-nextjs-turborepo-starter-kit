import { Avatar } from "@workspace/ui-native/components/avatar";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const TEAMMATES: readonly SelectOption<string>[] = [
	{ value: "olivia", label: "Olivia Martin", leading: <Avatar name="Olivia Martin" imageUrl={null} size="sm" /> },
	{ value: "jackson", label: "Jackson Lee", leading: <Avatar name="Jackson Lee" imageUrl={null} size="sm" /> },
	{ value: "isabella", label: "Isabella Nguyen", leading: <Avatar name="Isabella Nguyen" imageUrl={null} size="sm" /> },
	{ value: "william", label: "William Kim", leading: <Avatar name="William Kim" imageUrl={null} size="sm" /> },
];

export function Select29Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("olivia");
	return <SelectField label="Assign to" options={TEAMMATES} value={value} onChange={setValue} placeholder="Select a teammate" />;
}
