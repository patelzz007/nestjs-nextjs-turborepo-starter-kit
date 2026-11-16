import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@workspace/ui/components/command";

export function CommandDo1Example(): React.JSX.Element {
	return (
		<Command className="w-full max-w-xs rounded-lg border">
			<CommandInput placeholder="Type a command" />
			<CommandList>
				<CommandEmpty>No command matches.</CommandEmpty>
				<CommandGroup heading="Create">
					<CommandItem>
						New project
						<CommandShortcut>⌘N</CommandShortcut>
					</CommandItem>
					<CommandItem>
						Invite teammate
						<CommandShortcut>⌘I</CommandShortcut>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</Command>
	);
}
