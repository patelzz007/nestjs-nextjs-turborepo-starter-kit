import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input17Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<div className="flex items-center gap-2">
				<FieldLabel htmlFor="api-key">API Key</FieldLabel>
				<Badge variant="success-light">New</Badge>
			</div>
			<Input id="api-key" placeholder="9f82a1c4b7e243d8a6c9f1e2a3b4c5d6" />
		</Field>
	);
}
