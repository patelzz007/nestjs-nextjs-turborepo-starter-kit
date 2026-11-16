"use client";

import type * as React from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";

/** One question, its answer already rendered (on the server, from Markdown). */
export interface ShowcaseFaqItem {
	readonly question: string;
	readonly answer: React.ReactNode;
}

/** A component page's FAQ: one collapsible answer per question. */
export function ShowcaseFaqAccordion({ items }: { readonly items: readonly ShowcaseFaqItem[] }): React.JSX.Element {
	return (
		<Accordion>
			{items.map(({ question, answer }: ShowcaseFaqItem): React.JSX.Element => (
				<AccordionItem key={question} value={question}>
					<AccordionTrigger>{question}</AccordionTrigger>
					<AccordionContent>{answer}</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
