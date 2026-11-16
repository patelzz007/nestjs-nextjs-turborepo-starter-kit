"use client";

import { Button } from "@workspace/ui/components/button";
import { toast } from "@workspace/ui/components/toast";
import type * as React from "react";

/** A plain toast: no type, so it renders without a type icon or tint. */
function showEventToast(): void {
	toast.add({ title: "Event has been created" });
}

export function Sonner1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showEventToast} variant="outline" className="w-fit">
				Show Toast
			</Button>
		</div>
	);
}
