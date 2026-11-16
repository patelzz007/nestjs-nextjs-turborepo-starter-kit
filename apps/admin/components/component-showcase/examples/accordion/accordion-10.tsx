import * as React from "react";
import { ChevronRightIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";

const items = [
	{
		value: "item-1",
		trigger: "Can I use this for my project?",
		content: "Yes, you can use ReUI for any of your personal or commercial projects. The library is distributed under the MIT license.",
	},
	{
		value: "item-2",
		trigger: "Is there a Figma file available?",
		content: "We are currently working on a comprehensive Figma design system that will be released soon to all ReUI users.",
	},
	{
		value: "item-3",
		trigger: "How do I contribute to ReUI?",
		content: "You can contribute by reporting bugs, suggesting features, or submitting pull requests on our GitHub repository.",
	},
];

export function Accordion10Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Accordion multiple={false} defaultValue={["item-1"]}>
				{items.map((item) => (
					<AccordionItem key={item.value} value={item.value}>
						<AccordionTrigger className="flex-row-reverse items-center justify-end gap-3 py-3 hover:no-underline *:data-[slot=accordion-trigger-icon]:hidden">
							<span className="font-medium text-foreground/90">{item.trigger}</span>
							<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-90" />
						</AccordionTrigger>
						<AccordionContent className="ps-7 leading-relaxed text-muted-foreground">{item.content}</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	);
}
