import * as React from "react";
import { LockIcon, MailIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";

export function Field11Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<FieldGroup>
				<Field data-invalid>
					<FieldLabel htmlFor="val-email">
						Email <span className="text-destructive">*</span>
					</FieldLabel>
					<InputGroup>
						<InputGroupAddon>
							<MailIcon aria-hidden="true" />
						</InputGroupAddon>
						<InputGroupInput id="val-email" type="email" defaultValue="invalid-email" placeholder="you@example.com" />
					</InputGroup>
					<FieldError>Please enter a valid email address.</FieldError>
				</Field>
				<Field data-invalid>
					<FieldLabel htmlFor="val-password">
						Password <span className="text-destructive">*</span>
					</FieldLabel>
					<InputGroup>
						<InputGroupAddon>
							<LockIcon aria-hidden="true" />
						</InputGroupAddon>
						<InputGroupInput id="val-password" type="password" defaultValue="short" placeholder="Enter password" />
					</InputGroup>
					<FieldError errors={[{ message: "Must be at least 8 characters." }, { message: "Must contain at least one number." }]} />
				</Field>
				<Field>
					<FieldLabel htmlFor="val-confirm">Confirm Password</FieldLabel>
					<InputGroup>
						<InputGroupAddon>
							<LockIcon aria-hidden="true" />
						</InputGroupAddon>
						<InputGroupInput id="val-confirm" type="password" placeholder="Repeat password" />
					</InputGroup>
					<FieldDescription>Re-enter your password to confirm.</FieldDescription>
				</Field>
				<Button className="w-full">Create Account</Button>
			</FieldGroup>
		</div>
	);
}
