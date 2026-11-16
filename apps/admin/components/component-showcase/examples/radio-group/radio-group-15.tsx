import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RadioGroup15Example(): React.JSX.Element {
	return (
		<RadioGroup defaultValue="stable" className="w-fit">
			<Field orientation="horizontal">
				<RadioGroupItem value="stable" id="ch-stable" />
				<div className="flex items-center gap-2">
					<FieldLabel htmlFor="ch-stable">Stable</FieldLabel>
					<Badge variant="secondary" className="h-4.5 rounded-full px-1.5 text-[10px] tracking-wider uppercase">
						Recommended
					</Badge>
				</div>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="beta" id="ch-beta" />
				<div className="flex items-center gap-2">
					<FieldLabel htmlFor="ch-beta">Beta</FieldLabel>
					<Badge className="h-4.5 rounded-full px-1.5 text-[10px] tracking-wider uppercase">New</Badge>
				</div>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="canary" id="ch-canary" />
				<FieldLabel htmlFor="ch-canary">Canary</FieldLabel>
			</Field>
		</RadioGroup>
	);
}
