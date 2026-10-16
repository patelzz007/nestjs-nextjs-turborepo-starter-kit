import * as React from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Kbd } from "@workspace/ui/components/kbd";

export function Kbd4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<InputGroup className="max-w-xs">
				<InputGroupInput placeholder="Search…" />
				<InputGroupAddon>
					<Kbd>Space</Kbd>
				</InputGroupAddon>
			</InputGroup>
		</div>
	);
}
