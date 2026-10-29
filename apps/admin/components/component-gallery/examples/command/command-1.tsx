import * as React from "react";
import { CalculatorIcon, CalendarIcon, CreditCardIcon, SettingsIcon, SmileIcon, UserIcon } from "lucide-react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@workspace/ui/components/command";

export function Command1Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs p-0">
			<CardContent className="p-0">
				<Command>
					<CommandInput placeholder="Type a command or search..." />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup heading="Suggestions">
							<CommandItem value="Calendar">
								<CalendarIcon />
								<span>Calendar</span>
							</CommandItem>
							<CommandItem value="Search Emoji">
								<SmileIcon />
								<span>Search Emoji</span>
							</CommandItem>
							<CommandItem value="Calculator" disabled>
								<CalculatorIcon />
								<span>Calculator</span>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Settings">
							<CommandItem value="Profile">
								<UserIcon />
								<span>Profile</span>
								<CommandShortcut>⌘P</CommandShortcut>
							</CommandItem>
							<CommandItem value="Billing">
								<CreditCardIcon />
								<span>Billing</span>
								<CommandShortcut>⌘B</CommandShortcut>
							</CommandItem>
							<CommandItem value="Settings">
								<SettingsIcon />
								<span>Settings</span>
								<CommandShortcut>⌘S</CommandShortcut>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</CardContent>
		</Card>
	);
}
