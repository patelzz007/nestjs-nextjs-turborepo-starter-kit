"use client";

import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

function showPaymentToast(): void {
	const id = toastMessage.success({
		title: "Payment Successful",
		description: "Invoice #INV-2025-0042 has been paid. $2,400.00 received.",
		actionProps: {
			children: "View Receipt",
			onClick: (): void => {
				toast.close(id);
			},
		},
	});
}

export function Sonner13Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showPaymentToast} variant="outline" className="w-fit">
				Payment Success Toast
			</Button>
		</div>
	);
}
