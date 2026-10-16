import * as React from "react";
import { Button } from "@workspace/ui/components/button";

export function Button46Example(): React.JSX.Element {
	return (
		<Button variant="outline" className="relative pr-8" aria-label="Deploy (ready)">
			Live
			<span aria-hidden="true" className="absolute top-1/2 right-3 -translate-y-1/2">
				<span className="relative flex size-2 rounded-full bg-tone-green before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-tone-green before:opacity-75 before:duration-1500 after:absolute after:inset-0 after:animate-ping after:rounded-full after:bg-tone-green after:opacity-40 after:delay-500 after:duration-1500" />
			</span>
		</Button>
	);
}
