import CreditCardIcon from "lucide-react-native/icons/credit-card";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import * as React from "react";

export function Checkbox17Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return (
		<Checkbox
			variant="card"
			label="Visa •••• 4242"
			description="Expires 08/28"
			leading={<IconTile icon={CreditCardIcon} tone="blue" size="sm" />}
			controlPosition="end"
			checked={checked}
			onChange={setChecked}
		/>
	);
}
