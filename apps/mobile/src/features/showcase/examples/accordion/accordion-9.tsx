import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import * as React from "react";
import { Text } from "react-native";

interface Member {
	readonly value: string;
	readonly name: string;
	readonly role: string;
	readonly tone: BadgeTone;
	readonly access: string;
}

const MEMBERS: readonly Member[] = [
	{ value: "ava", name: "Ava Patel", role: "Owner", tone: "destructive", access: "Everything, including billing and deleting the workspace." },
	{ value: "ben", name: "Ben Ortiz", role: "Editor", tone: "info", access: "Projects and files; no billing." },
	{ value: "chloe", name: "Chloe Kim", role: "Viewer", tone: "neutral", access: "Can view projects and comment." },
];
const INITIAL: readonly string[] = [];

export function Accordion9Example(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(INITIAL);
	return (
		<Accordion value={open} onChange={setOpen} variant="outlined">
			{MEMBERS.map((member: Member): React.JSX.Element => (
				<AccordionItem key={member.value} value={member.value}>
					<AccordionTrigger
						label={member.name}
						leading={<Avatar name={member.name} imageUrl={null} size="sm" />}
						trailing={<Badge label={member.role} tone={member.tone} size="sm" />}
					/>
					<AccordionContent>
						<Text className="text-body font-sans text-muted-foreground">{member.access}</Text>
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
