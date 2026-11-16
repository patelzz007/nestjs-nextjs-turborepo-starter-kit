import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";

const PHASES: readonly { readonly key: string; readonly title: string; readonly tasks: readonly StepperStep[]; readonly active: number }[] = [
	{
		key: "plan",
		title: "1. Plan",
		tasks: [
			{ key: "brief", title: "Write the brief" },
			{ key: "scope", title: "Agree the scope" },
		],
		active: 3,
	},
	{
		key: "build",
		title: "2. Build",
		tasks: [
			{ key: "api", title: "API" },
			{ key: "ui", title: "Screens", loading: true },
			{ key: "tests", title: "Tests" },
		],
		active: 2,
	},
	{ key: "ship", title: "3. Ship", tasks: [{ key: "release", title: "Release" }], active: 1 },
];
const INITIAL: readonly string[] = ["build"];

export function Stepper43Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(INITIAL);
	return (
		<Accordion value={open} onChange={setOpen} variant="separated">
			{PHASES.map((phase): React.JSX.Element => (
				<AccordionItem key={phase.key} value={phase.key}>
					<AccordionTrigger label={phase.title} indicator="chevron-start" />
					<AccordionContent>
						<Stepper steps={phase.tasks} value={phase.active} orientation="vertical" size="sm" completedTone="success" />
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
