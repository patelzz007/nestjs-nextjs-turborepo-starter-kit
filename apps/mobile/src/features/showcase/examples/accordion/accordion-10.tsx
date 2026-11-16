import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";
import { Text } from "react-native";

interface Entry {
	readonly value: string;
	readonly question: string;
	readonly answer: string;
}

const FAQ: readonly Entry[] = [
	{ value: "accessible", question: "Is it accessible?", answer: "Yes. Every trigger says whether its section is open, and screen readers can open it." },
	{ value: "styled", question: "Is it styled?", answer: "Yes. It comes with the kit's look, and you can add classes to any part." },
	{ value: "animated", question: "Is it animated?", answer: "Yes, sections fade in. Reduce Motion turns that off." },
];

const INITIAL: readonly string[] = ["accessible"];

export function Accordion10Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(INITIAL);
	return (
		<Accordion value={open} onChange={setOpen}>
			{FAQ.map((entry: Entry): React.JSX.Element => (
				<AccordionItem key={entry.value} value={entry.value}>
					<AccordionTrigger label={entry.question} indicator="chevron-start" />
					<AccordionContent className="pl-7">
						<Text className="text-body font-sans text-muted-foreground">{entry.answer}</Text>
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
