import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";

const RESP_ROLE_OPTIONS: readonly SelectOption<string>[] = [
	{ value: "admin", label: "Admin" },
	{ value: "member", label: "Member" },
	{ value: "viewer", label: "Viewer" },
];

export function Field9Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-lg">
			<FieldGroup>
				<Field orientation="responsive">
					<FieldLabel htmlFor="resp-first">First Name</FieldLabel>
					<Input id="resp-first" placeholder="First name" />
				</Field>
				<Field orientation="responsive">
					<FieldLabel htmlFor="resp-last">Last Name</FieldLabel>
					<Input id="resp-last" placeholder="Last name" />
				</Field>
				<Field orientation="responsive">
					<FieldLabel htmlFor="resp-email">Email</FieldLabel>
					<Input id="resp-email" type="email" placeholder="you@example.com" />
				</Field>
				<Field orientation="responsive">
					<FieldLabel htmlFor="resp-role">Role</FieldLabel>
					<Select items={RESP_ROLE_OPTIONS} defaultValue="member">
						<SelectTrigger id="resp-role">
							<SelectValue placeholder="Select role" />
						</SelectTrigger>
						<SelectContent>
							{RESP_ROLE_OPTIONS.map((option: SelectOption<string>): React.JSX.Element => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				<FieldSeparator />
				<FieldDescription>The invited member will receive an email with a link to join.</FieldDescription>
				<div className="flex justify-end gap-2">
					<Button variant="outline">Cancel</Button>
					<Button>Send Invite</Button>
				</div>
			</FieldGroup>
		</div>
	);
}
