import * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";

const items = [
	{
		value: "security",
		trigger: "Data Security",
		content: "We use industry-standard AES-256 encryption to protect your sensitive information at rest and in transit.",
	},
	{
		value: "integration",
		trigger: "API Integration",
		content: "Seamlessly connect with your favorite tools using our robust REST API and pre-built connectors.",
	},
	{
		value: "collaboration",
		trigger: "Team Collaboration",
		content: "Invite team members, assign roles, and work together in real-time on shared projects and documents.",
	},
];

export function Accordion2Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Accordion multiple defaultValue={["security"]}>
				{items.map((item) => (
					<AccordionItem key={item.value} value={item.value}>
						<AccordionTrigger className="hover:no-underline *:data-[slot=accordion-trigger-icon]:hidden">
							<span>{item.trigger}</span>
							<PlusIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/accordion-trigger:hidden" />
							<MinusIcon className="ml-auto hidden size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/accordion-trigger:inline" />
						</AccordionTrigger>
						<AccordionContent>{item.content}</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	);
}
