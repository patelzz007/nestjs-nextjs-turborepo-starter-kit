import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";

const AREAS: readonly { readonly key: string; readonly title: string; readonly status: string; readonly steps: readonly StepperStep[]; readonly active: number }[] = [
	{
		key: "identity",
		title: "Identity",
		status: "Done",
		steps: [
			{ key: "mfa", title: "Two-factor sign-in" },
			{ key: "sso", title: "Single sign-on" },
		],
		active: 3,
	},
	{
		key: "data",
		title: "Data",
		status: "In progress",
		steps: [
			{ key: "backup", title: "Backups" },
			{ key: "encryption", title: "Encryption at rest" },
			{ key: "retention", title: "Retention" },
		],
		active: 2,
	},
	{ key: "network", title: "Network", status: "Pending", steps: [{ key: "firewall", title: "Firewall rules" }], active: 1 },
];
const INITIAL: readonly string[] = ["data"];

export function Stepper21Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(INITIAL);
	return (
		<Accordion value={open} onChange={setOpen} type="multiple" variant="outlined">
			{AREAS.map((area): React.JSX.Element => (
				<AccordionItem key={area.key} value={area.key}>
					<AccordionTrigger
						label={area.title}
						trailing={<Badge label={area.status} tone={area.status === "Done" ? "success" : area.status === "Pending" ? "neutral" : "info"} size="sm" />}
					/>
					<AccordionContent>
						<Stepper steps={area.steps} value={area.active} orientation="vertical" completedTone="success" size="sm" />
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
