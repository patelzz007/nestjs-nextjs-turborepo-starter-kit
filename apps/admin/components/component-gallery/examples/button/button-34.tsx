import * as React from "react";
import { MailIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button34Example(): React.JSX.Element {
	return (
		<Button>
			<MailIcon aria-hidden="true" />
			Login with Email
		</Button>
	);
}
