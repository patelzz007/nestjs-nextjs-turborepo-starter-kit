"use client";

import { Button } from "@workspace/ui/components/button";
import { toast } from "@workspace/ui/components/toast";
import type * as React from "react";

function showEventToast(): void {
	toast.add({ title: "Event has been created", description: "Monday, January 3rd at 6:00pm" });
}

export function Sonner2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showEventToast} variant="outline" className="w-fit">
				Show Toast with Description
			</Button>
		</div>
	);
}
