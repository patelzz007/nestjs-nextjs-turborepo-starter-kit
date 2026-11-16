import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function Label8Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-badge" className="gap-2">
				Webhook URL
				<Badge variant="success-light" size="sm">
					Active
				</Badge>
			</Label>
			<Input id="label-badge" type="url" defaultValue="https://api.example.com/webhooks" className="font-mono text-xs" />
		</Field>
	);
}
