import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@workspace/ui/components/command";

export function CommandDont1Example(): React.JSX.Element {
	return (
		<Command className="w-full max-w-xs rounded-lg border">
			<CommandInput placeholder="Type a command" />
			<CommandList>
				<CommandEmpty>No command matches.</CommandEmpty>
				<CommandGroup heading="Actions">
					<CommandItem>Do it</CommandItem>
					<CommandItem>Go</CommandItem>
				</CommandGroup>
			</CommandList>
		</Command>
	);
}
