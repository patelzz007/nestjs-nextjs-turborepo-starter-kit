import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup24Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupInput defaultValue="northwind_dev" />
				<InputGroupAddon align="inline-end">
					<div className="flex size-4 items-center justify-center rounded-full bg-emerald-500">
						<CheckIcon className="size-3 text-white" />
					</div>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
