import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner4Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="search-loading">Searching</FieldLabel>
			<InputGroup id="search-loading">
				<InputGroupInput placeholder="Search records…" />
				<InputGroupAddon>
					<Spinner className="size-4" />
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
