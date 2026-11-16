import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
import { Frame, FramePanel } from "@workspace/ui-native/components/frame";
import * as React from "react";
import { Text } from "react-native";

// One run step: its title bar opens and closes its instructions, open on load.
export function Frame5Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(true);
	return (
		<Frame stacked>
			<Collapsible open={open} onOpenChange={setOpen} className="gap-0.75">
				<CollapsibleTrigger label="Start" indicator="chevron" className="px-4 py-2" />
				<CollapsibleContent>
					<FramePanel>
						<Text className="text-label font-sans text-muted-foreground">
							Initialize run to answer a user question using uploaded files and the knowledge base; cite sources when relevant.
						</Text>
					</FramePanel>
				</CollapsibleContent>
			</Collapsible>
		</Frame>
	);
}
