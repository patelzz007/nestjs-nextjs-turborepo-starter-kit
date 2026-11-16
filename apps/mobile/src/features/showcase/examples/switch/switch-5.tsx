import { FieldSet } from "@workspace/ui-native/components/field";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function Switch5Example(): React.JSX.Element {
	const [email, setEmail] = React.useState<boolean>(true);
	const [sms, setSms] = React.useState<boolean>(false);
	const [push, setPush] = React.useState<boolean>(true);
	return (
		<FieldSet legend="Channels">
			<Switch label="Email" controlPosition="start" checked={email} onChange={setEmail} />
			<Switch label="SMS" controlPosition="start" checked={sms} onChange={setSms} />
			<Switch label="Push" controlPosition="start" checked={push} onChange={setPush} />
		</FieldSet>
	);
}
