import * as React from "react";
import { Field, FieldDescription } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function Label10Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<div className="flex flex-col gap-1">
				<Label htmlFor="label-helper">API Key</Label>
				<FieldDescription>Your secret key for API authentication</FieldDescription>
			</div>
			<Input id="label-helper" placeholder="sk_live_..." className="font-mono" />
		</Field>
	);
}
