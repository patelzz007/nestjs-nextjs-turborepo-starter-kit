import * as React from "react";
import { Card } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { Separator } from "@workspace/ui/components/separator";

export function Checkbox11Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs p-0">
			<FieldGroup className="gap-0">
				<Field>
					<FieldLabel className="px-4 py-3">
						<Checkbox defaultChecked />
						<FieldTitle>Push notifications</FieldTitle>
					</FieldLabel>
				</Field>
				<Separator />
				<Field>
					<FieldLabel className="px-4 py-3">
						<Checkbox />
						<FieldTitle>Email notifications</FieldTitle>
					</FieldLabel>
				</Field>
				<Separator />
				<Field>
					<FieldLabel className="px-4 py-3">
						<Checkbox />
						<FieldTitle>SMS notifications</FieldTitle>
					</FieldLabel>
				</Field>
			</FieldGroup>
		</Card>
	);
}
