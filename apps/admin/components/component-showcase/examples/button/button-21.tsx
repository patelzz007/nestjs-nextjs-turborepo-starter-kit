import * as React from "react";
import { LogOutIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button21Example(): React.JSX.Element {
	return (
		<Button variant="ghost">
			Logout
			<LogOutIcon aria-hidden="true" />
		</Button>
	);
}
