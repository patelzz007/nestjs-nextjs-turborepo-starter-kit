import * as React from "react";
import { ShieldCheckIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover";

export function InputGroup22Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup className="gap-0">
				<InputGroupAddon>
					<Popover>
						<PopoverTrigger render={<InputGroupButton variant="ghost" size="icon-xs" className="cursor-help" />}>
							<ShieldCheckIcon className="text-emerald-500" />
						</PopoverTrigger>
						<PopoverContent align="start" className="w-72">
							<PopoverHeader>
								<PopoverTitle>Secure Connection</PopoverTitle>
								<PopoverDescription>Your data is encrypted end-to-end using industry-standard protocols.</PopoverDescription>
							</PopoverHeader>
						</PopoverContent>
					</Popover>
				</InputGroupAddon>
				<InputGroupInput defaultValue="https://example.com" className="pl-0.5!" readOnly />
			</InputGroup>
		</Field>
	);
}
