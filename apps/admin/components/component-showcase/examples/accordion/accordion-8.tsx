import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";

const nestedItems = [
	{
		value: "sub-item-1",
		trigger: "Technical Specifications",
		content: "Detailed technical specs including dimensions, weight, and power requirements.",
	},
	{
		value: "sub-item-2",
		trigger: "Compatibility",
		content: "List of supported devices and operating systems for this product.",
	},
];

const mainItems = [
	{
		value: "product-info",
		trigger: "Product Overview",
		content: "This product is designed for high-performance enterprise environments requiring maximum reliability.",
	},
	{
		value: "details",
		trigger: "Additional Details",
		isNested: true,
	},
	{
		value: "shipping",
		trigger: "Shipping & Returns",
		content: "Free standard shipping on orders over $500. 30-day return policy applies.",
	},
];

export function Accordion8Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Accordion multiple={false} defaultValue={["details"]} className="space-y-2 border-none">
				{mainItems.map((item) => (
					<AccordionItem key={item.value} value={item.value} className="rounded-lg border border-border bg-transparent px-4">
						<AccordionTrigger className="items-center py-3 font-medium hover:no-underline">{item.trigger}</AccordionTrigger>
						<AccordionContent className="h-auto text-muted-foreground">
							{item.isNested ? (
								<Accordion multiple={false} defaultValue={["sub-item-1"]} className="space-y-2 border-none">
									{nestedItems.map((subItem) => (
										<AccordionItem key={subItem.value} value={subItem.value} className="rounded-lg border border-border bg-transparent px-3">
											<AccordionTrigger className="items-center py-3 font-medium text-foreground hover:no-underline">{subItem.trigger}</AccordionTrigger>
											<AccordionContent className="text-sm">{subItem.content}</AccordionContent>
										</AccordionItem>
									))}
								</Accordion>
							) : (
								item.content
							)}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	);
}
