import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@workspace/ui/components/command";

export function CommandDont2Example(): React.JSX.Element {
	return (
		<Command className="w-full max-w-xs rounded-lg border">
			<CommandInput placeholder="Search" />
			<CommandList>
				<CommandEmpty>No command matches.</CommandEmpty>
				<CommandGroup heading="Links">
					<CommandItem>Help</CommandItem>
					<CommandItem>Sign out</CommandItem>
				</CommandGroup>
			</CommandList>
		</Command>
	);
}
