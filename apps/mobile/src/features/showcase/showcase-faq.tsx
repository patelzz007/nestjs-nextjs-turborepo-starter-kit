import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";
import { Text, View } from "react-native";

import type { ShowcaseFaqEntry } from "./showcase-content";
import { ShowcaseMarkdown } from "./showcase-markdown";

const NONE_OPEN: readonly string[] = [];

/** A component's FAQ: one collapsible answer per question. */
export function ShowcaseFaq({ faq }: { readonly faq: readonly ShowcaseFaqEntry[] }): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(NONE_OPEN);
	return (
		<View className="gap-4" testID="showcase-faq">
			<Text accessibilityRole="header" className="text-h2 font-sans-bold text-foreground">
				Frequently asked questions
			</Text>
			<Accordion value={open} onChange={setOpen}>
				{faq.map(({ question, answer }: ShowcaseFaqEntry): React.JSX.Element => (
					<AccordionItem key={question} value={question}>
						<AccordionTrigger label={question} />
						<AccordionContent>
							<ShowcaseMarkdown source={answer} />
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</View>
	);
}
