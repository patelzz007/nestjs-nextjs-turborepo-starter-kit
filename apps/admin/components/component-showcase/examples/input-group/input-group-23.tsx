import * as React from "react";
import { CommandIcon, SparklesIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";

export function InputGroup23Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupAddon>
					<SparklesIcon className="text-emerald-500" />
				</InputGroupAddon>
				<InputGroupInput placeholder="Ask AI to generate..." />
				<InputGroupAddon align="inline-end">
					<KbdGroup>
						<Kbd>
							<CommandIcon className="size-3" />
						</Kbd>
						<Kbd>Enter</Kbd>
					</KbdGroup>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
