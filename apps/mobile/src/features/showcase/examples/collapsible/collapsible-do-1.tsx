import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
import * as React from "react";
import { Text } from "react-native";

const ANSWER = "Go to Settings, then Security, and tap Reset password. We email you a link that works for 30 minutes.";

export function CollapsibleDo1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	return (
		<Collapsible open={open} onOpenChange={setOpen} variant="card">
			<CollapsibleTrigger label="How do I reset my password?" />
			<CollapsibleContent>
				<Text className="text-body font-sans text-muted-foreground">{ANSWER}</Text>
			</CollapsibleContent>
		</Collapsible>
	);
}
