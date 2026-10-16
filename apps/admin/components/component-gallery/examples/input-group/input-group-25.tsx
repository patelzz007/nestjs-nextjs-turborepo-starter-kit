import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function InputGroup25Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupAddon>
					<SearchIcon className="size-4 text-muted-foreground" />
				</InputGroupAddon>
				<InputGroupInput placeholder="Search logs..." />
				<InputGroupAddon align="inline-end">
					<InputGroupText className="text-xs text-muted-foreground">12 results</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
