import * as React from "react";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";

export function Avatar14Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2">
			<Avatar className="after:border-primary/10">
				<AvatarFallback className="bg-primary/10 text-primary">AB</AvatarFallback>
			</Avatar>
			<Avatar className="after:border-destructive/10">
				<AvatarFallback className="bg-destructive/10 text-destructive">DV</AvatarFallback>
			</Avatar>
			<Avatar className="after:border-success-soft">
				<AvatarFallback className="bg-success-soft text-success">SB</AvatarFallback>
			</Avatar>
			<Avatar className="after:border-tone-violet-soft">
				<AvatarFallback className="bg-tone-violet-soft text-tone-violet">DB</AvatarFallback>
			</Avatar>
		</div>
	);
}
