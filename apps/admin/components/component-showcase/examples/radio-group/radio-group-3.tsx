import * as React from "react";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroup3Example(): React.JSX.Element {
	return (
		<RadioGroup defaultValue="comfortable" className="w-fit">
			<Field orientation="horizontal">
				<RadioGroupItem value="default" id="desc-r1" />
				<FieldContent>
					<FieldLabel htmlFor="desc-r1">Default</FieldLabel>
					<FieldDescription>Standard spacing for most use cases.</FieldDescription>
				</FieldContent>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="comfortable" id="desc-r2" />
				<FieldContent>
					<FieldLabel htmlFor="desc-r2">Comfortable</FieldLabel>
					<FieldDescription>More space between elements.</FieldDescription>
				</FieldContent>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="compact" id="desc-r3" />
				<FieldContent>
					<FieldLabel htmlFor="desc-r3">Compact</FieldLabel>
					<FieldDescription>Minimal spacing for dense layouts.</FieldDescription>
				</FieldContent>
			</Field>
		</RadioGroup>
	);
}
