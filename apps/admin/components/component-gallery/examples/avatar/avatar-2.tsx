import * as React from "react";
import { UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";

export function Avatar2Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2">
			<Avatar>
				<AvatarFallback>AJ</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarFallback>
					<UserIcon className="size-4" aria-hidden="true" />
				</AvatarFallback>
			</Avatar>
		</div>
	);
}
