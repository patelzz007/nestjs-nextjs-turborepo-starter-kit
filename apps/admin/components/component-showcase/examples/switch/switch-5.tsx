import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

export function Switch5Example(): React.JSX.Element {
	return (
		<Field className="w-auto">
			<FieldLabel>Notification Settings</FieldLabel>
			<Field orientation="horizontal">
				<Switch id="sg-email" defaultChecked />
				<FieldLabel htmlFor="sg-email">Email notifications</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<Switch id="sg-sms" />
				<FieldLabel htmlFor="sg-sms">SMS notifications</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<Switch id="sg-push" defaultChecked />
				<FieldLabel htmlFor="sg-push">Push notifications</FieldLabel>
			</Field>
		</Field>
	);
}
