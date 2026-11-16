import * as React from "react";
import { PlusIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar12Example(): React.JSX.Element {
	return (
		<AvatarGroup>
			<Avatar>
				<AvatarImage src="https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80" alt="Nick Johnson" />
				<AvatarFallback>NJ</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson (away)" />
				<AvatarFallback>AJ</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarImage src="https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80" alt="Sarah Chen" />
				<AvatarFallback>SC</AvatarFallback>
			</Avatar>
			<AvatarGroupCount>
				<PlusIcon aria-hidden="true" />
			</AvatarGroupCount>
		</AvatarGroup>
	);
}
