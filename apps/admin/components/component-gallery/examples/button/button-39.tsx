import * as React from "react";
import { MailIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";

export function Button39Example(): React.JSX.Element {
	return (
		<Button variant="outline" className="relative gap-2" aria-label="Inbox (8 unread)">
			<MailIcon aria-hidden="true" />
			Inbox
			<Badge variant="destructive" size="sm" className="absolute -top-1.5 -right-2 rounded-full px-1" aria-hidden="true">
				8
			</Badge>
		</Button>
	);
}
