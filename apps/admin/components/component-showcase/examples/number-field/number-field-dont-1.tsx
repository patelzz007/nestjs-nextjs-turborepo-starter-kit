import * as React from "react";
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput, NumberFieldScrubArea } from "@workspace/ui/components/number-field";

export function NumberFieldDont1Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-48">
			<NumberField defaultValue={0}>
				<NumberFieldScrubArea label="Guests" />
				<NumberFieldGroup>
					<NumberFieldDecrement />
					<NumberFieldInput />
					<NumberFieldIncrement />
				</NumberFieldGroup>
			</NumberField>
		</div>
	);
}
