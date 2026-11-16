import BellIcon from "lucide-react-native/icons/bell";
import CreditCardIcon from "lucide-react-native/icons/credit-card";
import ShieldIcon from "lucide-react-native/icons/shield";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";
import { Text } from "react-native";

interface Entry {
	readonly value: string;
	readonly question: string;
	readonly answer: string;
	readonly icon: LucideIcon;
	readonly isNew: boolean;
}

const FAQ: readonly Entry[] = [
	{ value: "security", question: "Security", answer: "Two-factor sign-in, sessions and recovery codes.", icon: ShieldIcon, isNew: false },
	{ value: "notifications", question: "Notifications", answer: "Choose what reaches you by email and push.", icon: BellIcon, isNew: true },
	{ value: "billing", question: "Billing", answer: "Your plan, cards and invoices.", icon: CreditCardIcon, isNew: false },
];

const INITIAL: readonly string[] = [];

export function Accordion7Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(INITIAL);
	return (
		<Accordion value={open} onChange={setOpen} type="multiple" variant="outlined">
			{FAQ.map((entry: Entry): React.JSX.Element => (
				<AccordionItem key={entry.value} value={entry.value}>
					<AccordionTrigger label={entry.question} leading={<IconTile icon={entry.icon} tone="neutral" size="sm" />} />
					<AccordionContent>
						<Text className="text-body font-sans text-muted-foreground">{entry.answer}</Text>
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
