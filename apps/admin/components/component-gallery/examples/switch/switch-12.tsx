import * as React from "react";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

export function Switch12Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<FieldLabel htmlFor="sw-danger">
				<Field orientation="horizontal">
					<FieldContent>
						<FieldTitle className="text-destructive">Delete all data on sign out</FieldTitle>
						<FieldDescription>When enabled, all local data will be permanently removed when you sign out. This action cannot be undone.</FieldDescription>
					</FieldContent>
					<Switch id="sw-danger" className="data-checked:bg-destructive" />
				</Field>
			</FieldLabel>
		</div>
	);
}
