import RocketIcon from "lucide-react-native/icons/rocket";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
import * as React from "react";
import { Text } from "react-native";

export function CollapsibleDont2Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	return (
		<Collapsible open={open} onOpenChange={setOpen} variant="card">
			<CollapsibleTrigger label="Status" icon={RocketIcon} />
			<CollapsibleContent>
				<Text className="text-body font-sans text-muted-foreground">12 commits, 3 migrations. Build 48 s, all checks passed.</Text>
			</CollapsibleContent>
		</Collapsible>
	);
}
