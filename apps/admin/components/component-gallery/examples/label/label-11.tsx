import * as React from "react";
import { Field, FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function Label11Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs" data-invalid="true">
			<Label htmlFor="label-error">Email</Label>
			<Input id="label-error" type="email" defaultValue="invalid-email" aria-invalid="true" />
			<FieldError>Please enter a valid email address</FieldError>
		</Field>
	);
}
