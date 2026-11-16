import * as React from "react";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";

export function Avatar15Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2">
			<Avatar className="after:border-primary">
				<AvatarFallback className="bg-primary text-primary-foreground">AB</AvatarFallback>
			</Avatar>
			<Avatar className="after:border-destructive">
				<AvatarFallback className="bg-destructive text-status-foreground">AB</AvatarFallback>
			</Avatar>
			<Avatar className="after:border-success">
				<AvatarFallback className="bg-success text-status-foreground">AB</AvatarFallback>
			</Avatar>
			<Avatar className="after:border-info">
				<AvatarFallback className="bg-info text-status-foreground">CB</AvatarFallback>
			</Avatar>
		</div>
	);
}
