import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const ROLES: readonly RadioOption<string>[] = [
	{ value: "admin", label: "Admin" },
	{ value: "editor", label: "Editor" },
	{ value: "viewer", label: "Viewer" },
];

export function RadioGroup16Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("editor");
	return <RadioGroup label="Role" options={ROLES} orientation="horizontal" value={value} onChange={setValue} />;
}
