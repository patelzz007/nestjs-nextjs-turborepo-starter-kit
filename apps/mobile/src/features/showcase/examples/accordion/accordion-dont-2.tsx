import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";
import { Text } from "react-native";

interface Entry {
	readonly value: string;
	readonly question: string;
	readonly answer: string;
}

const FAQ: readonly Entry[] = [
	{ value: "q1", question: "More", answer: "Yes." },
	{ value: "q2", question: "Details", answer: "Yes." },
	{ value: "q3", question: "Info", answer: "Yes." },
];

const INITIAL: readonly string[] = ["q1"];

export function AccordionDont2Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(INITIAL);
	return (
		<Accordion value={open} onChange={setOpen}>
			{FAQ.map((entry: Entry): React.JSX.Element => (
				<AccordionItem key={entry.value} value={entry.value}>
					<AccordionTrigger label={entry.question} />
					<AccordionContent>
						<Text className="text-body font-sans text-muted-foreground">{entry.answer}</Text>
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
