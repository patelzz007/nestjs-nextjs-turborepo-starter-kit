"use client";

import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { toast } from "@workspace/ui/components/toast";

function showToast(): void {
	toast.add({ title: "Invoice sent", description: "To ada@example.com." });
}

export function ToastDo1Example(): React.JSX.Element {
	return (
		<Button variant="outline" onClick={showToast}>
			Send invoice
		</Button>
	);
}
