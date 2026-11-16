import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLegend, FieldSet, FieldTitle } from "@workspace/ui/components/field";

export function Field8Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<FieldGroup>
				<FieldSet>
					<FieldLegend variant="label">Access Permissions</FieldLegend>
					<FieldDescription>Configure what this role can access.</FieldDescription>
					<FieldGroup className="gap-4">
						<Field orientation="horizontal">
							<Checkbox id="perm-read" defaultChecked />
							<FieldContent>
								<FieldTitle>Read</FieldTitle>
								<FieldDescription>View resources and data. Cannot make changes.</FieldDescription>
							</FieldContent>
						</Field>
						<Field orientation="horizontal">
							<Checkbox id="perm-write" defaultChecked />
							<FieldContent>
								<FieldTitle>Write</FieldTitle>
								<FieldDescription>Create and edit resources. Requires read access.</FieldDescription>
							</FieldContent>
						</Field>
						<Field orientation="horizontal">
							<Checkbox id="perm-delete" />
							<FieldContent>
								<FieldTitle>Delete</FieldTitle>
								<FieldDescription>Permanently remove resources. This action is irreversible.</FieldDescription>
							</FieldContent>
						</Field>
						<Field orientation="horizontal">
							<Checkbox id="perm-admin" disabled />
							<FieldContent>
								<FieldTitle>Admin</FieldTitle>
								<FieldDescription>Full access to all settings. Only available to owners.</FieldDescription>
							</FieldContent>
						</Field>
					</FieldGroup>
				</FieldSet>
			</FieldGroup>
		</div>
	);
}
