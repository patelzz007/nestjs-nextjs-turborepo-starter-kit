import { Button } from "@workspace/ui-native/components/button";
import { Field } from "@workspace/ui-native/components/field";
import { NumberField } from "@workspace/ui-native/components/number-field";
import * as React from "react";
import { View } from "react-native";
import { z } from "zod";

import { ignorePress } from "../example-support";

const MIN = 10;
const MAX = 1000;

/** The form's rule for the amount. */
const AmountSchema = z.number({ error: "Enter an amount." }).min(MIN, { error: "At least $10." }).max(MAX, { error: "At most $1,000." });

/** An amount in whole dollars. */
function asDollars(value: number): string {
	return `$${String(value)}`;
}

export function NumberField6Example(): React.JSX.Element {
	const [amount, setAmount] = React.useState<number | null>(5);
	const error = AmountSchema.safeParse(amount).error?.issues.at(0)?.message;
	return (
		<View className="gap-3">
			<Field label="Amount" hint="Between 10 and 1,000." error={error}>
				<NumberField value={amount} onChange={setAmount} step={10} formatValue={asDollars} layout="end" />
			</Field>
			<View className="flex-row gap-2">
				<Button label="Cancel" variant="outline" onPress={ignorePress} className="flex-1" />
				<Button label="Save" disabled={error !== undefined} onPress={ignorePress} className="flex-1" />
			</View>
		</View>
	);
}
