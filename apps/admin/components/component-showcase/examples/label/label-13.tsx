import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function Label13Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-status" className="gap-1.5">
				Server Status
				<span className="relative flex size-2">
					<span className="absolute inline-flex size-full animate-ping rounded-full bg-tone-green opacity-75" />
					<span className="relative inline-flex size-2 rounded-full bg-tone-green" />
				</span>
			</Label>
			<Input id="label-status" defaultValue="Online" disabled />
		</Field>
	);
}
