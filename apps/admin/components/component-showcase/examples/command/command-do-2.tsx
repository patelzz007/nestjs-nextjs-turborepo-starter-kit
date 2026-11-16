import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@workspace/ui/components/command";

const PLACES: readonly string[] = ["Dashboard", "Projects", "Invoices", "Customers", "Reports", "Team", "Billing", "Settings"];

export function CommandDo2Example(): React.JSX.Element {
	return (
		<Command className="w-full max-w-xs rounded-lg border">
			<CommandInput placeholder="Go to or do anything" />
			<CommandList>
				<CommandEmpty>No command matches.</CommandEmpty>
				<CommandGroup heading="Go to">
					{PLACES.map((place: string): React.JSX.Element => (
						<CommandItem key={place}>{place}</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</Command>
	);
}
