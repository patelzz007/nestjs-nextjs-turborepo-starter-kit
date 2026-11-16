import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Account help";
const DESCRIPTION = "Answers about plans, billing and security.";
const INITIAL: readonly string[] = ["plans"];

export function Accordion4Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(INITIAL);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent>
				<Accordion value={open} onChange={setOpen} type="multiple">
					<AccordionItem value="plans">
						<AccordionTrigger label="Which plan is right for me?" />
						<AccordionContent className="gap-3">
							<Text className="text-body font-sans text-muted-foreground">Start on Free; move to Pro when you need more seats or storage.</Text>
							<Button label="View plans" variant="outline" size="sm" onPress={ignorePress} className="self-start" />
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="billing">
						<AccordionTrigger label="When am I billed?" />
						<AccordionContent>
							<Text className="text-body font-sans text-muted-foreground">On the day you upgrade, then every month on that date.</Text>
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="security">
						<AccordionTrigger label="How is my data protected?" />
						<AccordionContent>
							<Text className="text-body font-sans text-muted-foreground">It is encrypted in transit and at rest, and backed up daily.</Text>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</CardContent>
		</Card>
	);
}
