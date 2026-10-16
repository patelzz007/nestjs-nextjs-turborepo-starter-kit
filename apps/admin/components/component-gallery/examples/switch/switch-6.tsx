import * as React from "react";
import { Card } from "@workspace/ui/components/card";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { Separator } from "@workspace/ui/components/separator";
import { Switch } from "@workspace/ui/components/switch";

export function Switch6Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs p-0">
			<FieldGroup className="gap-0">
				<Field>
					<FieldLabel className="justify-between px-4 py-3">
						<FieldTitle>Push notifications</FieldTitle>
						<Switch defaultChecked />
					</FieldLabel>
				</Field>
				<Separator />
				<Field>
					<FieldLabel className="justify-between px-4 py-3">
						<FieldTitle>Email notifications</FieldTitle>
						<Switch />
					</FieldLabel>
				</Field>
				<Separator />
				<Field>
					<FieldLabel className="justify-between px-4 py-3">
						<FieldTitle>SMS notifications</FieldTitle>
						<Switch />
					</FieldLabel>
				</Field>
			</FieldGroup>
		</Card>
	);
}
