import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function Label5Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-required">
				Email address
				<span className="text-destructive">*</span>
			</Label>
			<Input id="label-required" type="email" placeholder="you@example.com" required />
		</Field>
	);
}
