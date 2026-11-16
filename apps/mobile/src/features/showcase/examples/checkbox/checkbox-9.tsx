import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

export function Checkbox9Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return (
		<Checkbox variant="card" label="Weekly report" description="A summary of your workspace every Monday." controlPosition="end" checked={checked} onChange={setChecked} />
	);
}
