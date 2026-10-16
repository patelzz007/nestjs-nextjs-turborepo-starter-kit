import * as React from "react";
import { Card } from "@workspace/ui/components/card";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Separator } from "@workspace/ui/components/separator";

export function RadioGroup8Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs p-0">
			<RadioGroup defaultValue="standard">
				<FieldGroup className="gap-0">
					<Field>
						<FieldLabel className="px-4 py-3">
							<RadioGroupItem value="standard" id="ship-standard" />
							<FieldTitle>Standard Shipping</FieldTitle>
						</FieldLabel>
					</Field>
					<Separator />
					<Field>
						<FieldLabel className="px-4 py-3">
							<RadioGroupItem value="express" id="ship-express" />
							<FieldTitle>Express Shipping</FieldTitle>
						</FieldLabel>
					</Field>
					<Separator />
					<Field>
						<FieldLabel className="px-4 py-3">
							<RadioGroupItem value="overnight" id="ship-overnight" />
							<FieldTitle>Overnight Shipping</FieldTitle>
						</FieldLabel>
					</Field>
				</FieldGroup>
			</RadioGroup>
		</Card>
	);
}
