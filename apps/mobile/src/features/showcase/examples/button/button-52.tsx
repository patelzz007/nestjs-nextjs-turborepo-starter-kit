import CreditCardIcon from "lucide-react-native/icons/credit-card";
import { Button } from "@workspace/ui-native/components/button";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button52Example(): React.JSX.Element {
	return (
		<Button
			label="Credit card"
			description="Pay with Visa, Mastercard or American Express."
			variant="outline"
			leading={<IconTile icon={CreditCardIcon} tone="blue" size="sm" />}
			onPress={ignorePress}
		/>
	);
}
