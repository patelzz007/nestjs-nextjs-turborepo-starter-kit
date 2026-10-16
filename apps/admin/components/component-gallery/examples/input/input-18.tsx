import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input18Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<div className="flex items-center justify-between gap-2">
				<FieldLabel htmlFor="middle-name">Middle Name</FieldLabel>
				<Badge variant="warning-outline" size="sm">
					Optional
				</Badge>
			</div>
			<Input id="middle-name" placeholder="Alexander" />
		</Field>
	);
}
