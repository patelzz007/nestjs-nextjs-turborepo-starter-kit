import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function AccordionDont1Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-md flex-col gap-3">
			<Accordion>
				<AccordionItem value="terms">
					<AccordionTrigger>Terms of service</AccordionTrigger>
					<AccordionContent>You agree to pay every invoice within 30 days, and to the cancellation fee in section 4.</AccordionContent>
				</AccordionItem>
			</Accordion>
			<Field orientation="horizontal">
				<Checkbox id="accordion-dont-1-terms" />
				<FieldLabel htmlFor="accordion-dont-1-terms">I accept the terms</FieldLabel>
			</Field>
		</div>
	);
}
