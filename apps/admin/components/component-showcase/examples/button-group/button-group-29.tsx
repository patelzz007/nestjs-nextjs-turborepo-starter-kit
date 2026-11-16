import * as React from "react";
import { UserPlusIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";

export function ButtonGroup29Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button size="sm" variant="outline">
				<UserPlusIcon aria-hidden="true" />
				Follow
			</Button>
			<ButtonGroupText className="text-muted-foreground">2.4k followers</ButtonGroupText>
		</ButtonGroup>
	);
}
