import { Badge } from "@workspace/ui-native/components/badge";
import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Label8Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("https://hooks.acme.com/orders");
	return (
		<Field label="Webhook URL" labelTrailing={<Badge label="Active" tone="success" size="sm" />}>
			<Input value={value} onChange={setValue} keyboardType="url" autoCapitalize="none" />
		</Field>
	);
}
