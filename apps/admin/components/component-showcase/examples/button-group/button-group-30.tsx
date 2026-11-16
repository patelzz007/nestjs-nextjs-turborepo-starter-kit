import * as React from "react";
import { StarIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";

export function ButtonGroup30Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button size="sm" variant="default" aria-label="Following 2.4k" className="border-primary">
				<StarIcon />
				Star
			</Button>
			<ButtonGroupText className="border-primary">2.4k</ButtonGroupText>
		</ButtonGroup>
	);
}
