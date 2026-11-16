import { Avatar } from "@workspace/ui-native/components/avatar";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

export function Checkbox15Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return (
		<Checkbox
			variant="card"
			label="Avery Chen"
			description="@avery"
			leading={<Avatar name="Avery Chen" imageUrl={null} size="md" />}
			controlPosition="end"
			checked={checked}
			onChange={setChecked}
		/>
	);
}
