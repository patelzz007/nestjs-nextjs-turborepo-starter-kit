import CreditCardIcon from "lucide-react-native/icons/credit-card";
import { Text, View } from "react-native";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

const CHECKS: readonly string[] = ["Check the card number", "Make sure it has not expired", "Confirm the billing address"];
const DETAILS = (
	<View className="gap-0.5">
		{CHECKS.map((check: string): React.JSX.Element => (
			<Text key={check} className="text-body font-sans text-destructive-foreground">{`• ${check}`}</Text>
		))}
	</View>
);

export function Alert4Example(): React.JSX.Element {
	return (
		<Alert tone="error" icon={CreditCardIcon} title="Your payment could not be processed" content={DETAILS}>
			<Button label="Update card" variant="destructive" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
