import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar33Example(): React.JSX.Element {
	return (
		<div className="group/avatar relative flex items-center justify-center">
			{/* Animated Story Ring */}
			<div className="absolute -inset-1 animate-[spin_3s_linear_infinite] rounded-full bg-linear-to-tr from-warning via-tone-violet to-tone-violet opacity-75 blur-xs transition-all duration-500 group-hover/avatar:opacity-100 group-hover/avatar:blur-sm" />

			{/* Main Avatar */}
			<Avatar className="size-10 ring-2 ring-background transition-transform duration-500 group-hover/avatar:scale-95">
				<AvatarImage src="https://github.com/shadcn.png" alt="User story" />
				<AvatarFallback>JD</AvatarFallback>
			</Avatar>
		</div>
	);
}
