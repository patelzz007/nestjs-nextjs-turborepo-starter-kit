import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";
import { Text } from "react-native";

const INITIAL: readonly string[] = [];
const ANSWER = "Read the steps below.";

export function AccordionDont1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(INITIAL);
	return (
		<Accordion value={open} onChange={setOpen}>
			<AccordionItem value="steps">
				<AccordionTrigger label="Required: accept the terms before you continue" />
				<AccordionContent>
					<Text className="text-body font-sans text-muted-foreground">{ANSWER}</Text>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
