import * as React from "react";
import { Textarea } from "@workspace/ui/components/textarea";

export function Textarea1Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<Textarea placeholder="Type your message here…" className="w-full" />
		</div>
	);
}
