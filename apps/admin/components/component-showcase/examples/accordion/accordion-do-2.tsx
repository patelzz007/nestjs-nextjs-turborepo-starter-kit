import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";

export function AccordionDo2Example(): React.JSX.Element {
	return (
		<Accordion className="w-full max-w-md">
			<AccordionItem value="refunds">
				<AccordionTrigger>How do refunds work?</AccordionTrigger>
				<AccordionContent>Refunds go back to the card you paid with within 5 working days.</AccordionContent>
			</AccordionItem>
			<AccordionItem value="plans">
				<AccordionTrigger>Can I change plans later?</AccordionTrigger>
				<AccordionContent>Yes. The new price applies from your next invoice.</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
