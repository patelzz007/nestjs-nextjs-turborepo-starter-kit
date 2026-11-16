import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function FieldDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Input type="email" placeholder="Email" defaultValue="ada@example.com" />
		</Field>
	);
}
