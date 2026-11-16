import { Card } from "@workspace/ui-native/components/card";
import { Separator } from "@workspace/ui-native/components/separator";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function Switch6Example(): React.JSX.Element {
	const [email, setEmail] = React.useState<boolean>(true);
	const [sms, setSms] = React.useState<boolean>(false);
	const [push, setPush] = React.useState<boolean>(true);
	return (
		<Card>
			<Switch label="Email" checked={email} onChange={setEmail} />
			<Separator />
			<Switch label="SMS" checked={sms} onChange={setSms} />
			<Separator />
			<Switch label="Push" checked={push} onChange={setPush} />
		</Card>
	);
}
