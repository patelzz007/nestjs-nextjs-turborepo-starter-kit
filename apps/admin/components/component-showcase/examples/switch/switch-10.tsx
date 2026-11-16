import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

export function Switch10Example(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-4">
			<Field orientation="horizontal">
				<Switch id="sw-badge-1" defaultChecked />
				<div className="flex items-center gap-2">
					<FieldLabel htmlFor="sw-badge-1">AI Copilot</FieldLabel>
					<Badge className="h-4.5 rounded-full px-1.5 text-[10px] tracking-wider uppercase">New</Badge>
				</div>
			</Field>
			<Field orientation="horizontal">
				<Switch id="sw-badge-2" />
				<div className="flex items-center gap-2">
					<FieldLabel htmlFor="sw-badge-2">Smart suggestions</FieldLabel>
					<Badge variant="secondary" className="h-4.5 rounded-full px-1.5 text-[10px] tracking-wider uppercase">
						Beta
					</Badge>
				</div>
			</Field>
		</div>
	);
}
