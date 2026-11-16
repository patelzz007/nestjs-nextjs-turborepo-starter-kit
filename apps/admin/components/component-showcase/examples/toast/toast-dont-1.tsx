"use client";

import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { toast } from "@workspace/ui/components/toast";

function showToast(): void {
	toast.add({
		title: "Invoice sent",
		description:
			"We sent invoice INV-0042 to ada@example.com. It is due in 30 days. Reminders go out 7 days before and on the due date, and you can change that in billing settings at any time.",
	});
}

export function ToastDont1Example(): React.JSX.Element {
	return (
		<Button variant="outline" onClick={showToast}>
			Send invoice
		</Button>
	);
}
