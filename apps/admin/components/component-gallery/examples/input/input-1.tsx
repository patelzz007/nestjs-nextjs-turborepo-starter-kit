import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input1Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Input id="basic-input" type="text" placeholder="Basic Input" />
		</Field>
	);
}
