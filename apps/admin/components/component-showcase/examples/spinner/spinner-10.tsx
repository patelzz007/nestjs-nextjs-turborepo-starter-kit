import * as React from "react";
export function Spinner10Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-1.5">
			<span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
			<span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
			<span className="size-2 animate-bounce rounded-full bg-primary" />
		</div>
	);
}
