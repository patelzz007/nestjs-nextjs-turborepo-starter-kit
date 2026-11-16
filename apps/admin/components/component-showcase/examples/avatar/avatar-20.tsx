import * as React from "react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar20Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-1.5 rounded-full border border-border p-1 shadow-sm shadow-scrim/5">
			<AvatarGroup>
				<Avatar className="size-7">
					<AvatarImage src="https://images.unsplash.com/photo-1542595913-85d69b0edbaf?w=96&h=96&dpr=2&q=80" alt="Liam Thompson" />
					<AvatarFallback>LT</AvatarFallback>
				</Avatar>
				<Avatar className="size-7">
					<AvatarImage src="https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80" alt="Nick Johnson" />
					<AvatarFallback>NJ</AvatarFallback>
				</Avatar>
				<Avatar className="size-7">
					<AvatarImage src="https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80" alt="Maria Garcia" />
					<AvatarFallback>MG</AvatarFallback>
				</Avatar>
				<Avatar className="size-7">
					<AvatarImage src="https://github.com/leerob.png" alt="@leerob" />
					<AvatarFallback>CH</AvatarFallback>
				</Avatar>
			</AvatarGroup>

			<p className="me-1.5 text-xs text-muted-foreground">
				Trusted by <span className="font-semibold text-foreground">100K+</span> users.
			</p>
		</div>
	);
}
