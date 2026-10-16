import * as React from "react";
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput, NumberFieldScrubArea } from "@workspace/ui/components/number-field";

export function NumberField2Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-48">
			<NumberField defaultValue={5} min={0} max={100} size="sm">
				<NumberFieldScrubArea label="Small" />
				<NumberFieldGroup>
					<NumberFieldDecrement />
					<NumberFieldInput />
					<NumberFieldIncrement />
				</NumberFieldGroup>
			</NumberField>
		</div>
	);
}
