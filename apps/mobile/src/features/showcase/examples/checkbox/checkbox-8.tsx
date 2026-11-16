import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { FieldSet } from "@workspace/ui-native/components/field";
import * as React from "react";

export function Checkbox8Example(): React.JSX.Element {
	const [email, setEmail] = React.useState<boolean>(true);
	const [sms, setSms] = React.useState<boolean>(false);
	const [push, setPush] = React.useState<boolean>(true);
	return (
		<FieldSet legend="Notify me by">
			<Checkbox label="Email" checked={email} onChange={setEmail} />
			<Checkbox label="SMS" checked={sms} onChange={setSms} />
			<Checkbox label="Push" checked={push} onChange={setPush} />
		</FieldSet>
	);
}
