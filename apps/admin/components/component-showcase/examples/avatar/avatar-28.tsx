import * as React from "react";
import { UserPlusIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar28Example(): React.JSX.Element {
	return (
		<div className="flex flex-col items-center gap-4 text-center">
			<AvatarGroup>
				<Avatar>
					<AvatarImage src="https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80" alt="sarah@example.com" className="grayscale" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" className="grayscale" />
					<AvatarFallback>LR</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage src="https://github.com/evilrabbit.png" alt="@evilrabbit" className="grayscale" />
					<AvatarFallback>ER</AvatarFallback>
				</Avatar>
				<AvatarGroupCount aria-label="Add collaborator">
					<UserPlusIcon aria-hidden="true" />
				</AvatarGroupCount>
			</AvatarGroup>
			<div className="space-y-0.5">
				<h3 className="text-sm font-medium">No active collaborators</h3>
				<p className="text-xs text-muted-foreground">Invite teammates to start working together.</p>
			</div>
		</div>
	);
}
