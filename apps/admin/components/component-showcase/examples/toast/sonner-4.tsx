"use client";

import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

// One toast per type: each type brings its own icon and soft tint.

function showDefault(): void {
	toast.add({ title: "Default notification" });
}

function showSuccess(): void {
	toastMessage.success({ title: "Operation completed" });
}

function showError(): void {
	toastMessage.error({ title: "Operation failed" });
}

function showWarning(): void {
	toastMessage.warning({ title: "Proceed with caution" });
}

function showInfo(): void {
	toastMessage.info({ title: "System update available" });
}

function showLoading(): void {
	toastMessage.loading({ title: "Processing..." });
}

export function Sonner4Example(): React.JSX.Element {
	return (
		<div className="grid grid-cols-3 gap-2">
			<Button size="sm" variant="outline" className="w-full" onClick={showDefault}>
				Default
			</Button>
			<Button size="sm" variant="outline" className="w-full" onClick={showSuccess}>
				Success
			</Button>
			<Button size="sm" variant="outline" className="w-full" onClick={showError}>
				Error
			</Button>
			<Button size="sm" variant="outline" className="w-full" onClick={showWarning}>
				Warning
			</Button>
			<Button size="sm" variant="outline" className="w-full" onClick={showInfo}>
				Info
			</Button>
			<Button size="sm" variant="outline" className="w-full" onClick={showLoading}>
				Loading
			</Button>
		</div>
	);
}
