import * as React from "react";
import { Share2Icon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";

export function ButtonGroup31Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button size="sm" className="border-primary">
				<Share2Icon />
				Share
			</Button>
			<ButtonGroupText className="bg-transparent px-2 text-muted-foreground">128 Shares</ButtonGroupText>
		</ButtonGroup>
	);
}
