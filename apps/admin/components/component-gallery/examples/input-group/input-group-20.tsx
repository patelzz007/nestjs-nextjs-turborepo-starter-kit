import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup20Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="search-input">Search Components</FieldLabel>
			<InputGroup>
				<InputGroupAddon>
					<SearchIcon className="text-muted-foreground" />
				</InputGroupAddon>
				<InputGroupInput id="search-input" placeholder="Search..." />
			</InputGroup>
		</Field>
	);
}
