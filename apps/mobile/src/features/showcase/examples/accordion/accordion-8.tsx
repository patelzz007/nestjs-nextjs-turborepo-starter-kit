import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";
import { Text } from "react-native";

const OUTER: readonly string[] = ["specs"];
const INNER: readonly string[] = ["display"];

export function Accordion8Example(): React.JSX.Element {
	const [outer, setOuter] = React.useState<readonly string[]>(OUTER);
	const [inner, setInner] = React.useState<readonly string[]>(INNER);
	return (
		<Accordion value={outer} onChange={setOuter} type="multiple" variant="separated">
			<AccordionItem value="overview">
				<AccordionTrigger label="Overview" />
				<AccordionContent>
					<Text className="text-body font-sans text-muted-foreground">A 14-inch laptop for work on the move.</Text>
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="specs">
				<AccordionTrigger label="Specifications" />
				<AccordionContent>
					<Accordion value={inner} onChange={setInner} type="multiple" variant="outlined">
						<AccordionItem value="display">
							<AccordionTrigger label="Display" />
							<AccordionContent>
								<Text className="text-body font-sans text-muted-foreground">14.2-inch, 3024 × 1964, 120 Hz.</Text>
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value="battery">
							<AccordionTrigger label="Battery" />
							<AccordionContent>
								<Text className="text-body font-sans text-muted-foreground">Up to 18 hours.</Text>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
