import * as React from "react";
import { CircleAlertIcon } from "lucide-react";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input21Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="security-code">Security Code</FieldLabel>
			<Input id="security-code" placeholder="Enter your security code" aria-invalid="true" />
			<FieldError className="mt-2 space-y-1.5 text-xs">
				<div className="flex items-center gap-1.5">
					<CircleAlertIcon className="size-3.5" />
					<span>Code must be at least 12 characters long</span>
				</div>
				<div className="flex items-center gap-1.5">
					<CircleAlertIcon className="size-3.5" />
					<span>Code must contain at least one uppercase letter</span>
				</div>
				<div className="flex items-center gap-1.5">
					<CircleAlertIcon className="size-3.5" />
					<span>Code cannot include common words or patterns</span>
				</div>
			</FieldError>
		</Field>
	);
}
