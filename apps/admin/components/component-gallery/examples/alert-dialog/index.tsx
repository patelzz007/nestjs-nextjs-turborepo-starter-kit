"use client";

// The AlertDialog examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { AlertDialog1Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-1";
import { AlertDialog2Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-2";
import { AlertDialog3Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-3";
import { AlertDialog4Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-4";
import { AlertDialog5Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-5";
import { AlertDialog6Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-6";
import { AlertDialog7Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-7";
import { AlertDialog8Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-8";
import { AlertDialog9Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-9";
import { AlertDialog10Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-10";
import { AlertDialog11Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-11";
import { AlertDialog12Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-12";
import { AlertDialog13Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-13";
import { AlertDialog14Example } from "@/components/component-gallery/examples/alert-dialog/alert-dialog-14";

export const ALERT_DIALOG_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-alert-dialog-1", label: "Basic", component: AlertDialog1Example },
	{ id: "c-alert-dialog-2", label: "Small Size", component: AlertDialog2Example },
	{ id: "c-alert-dialog-3", label: "With Icon", component: AlertDialog3Example },
	{ id: "c-alert-dialog-4", label: "Small With Icon", component: AlertDialog4Example },
	{ id: "c-alert-dialog-5", label: "Destructive Delete", component: AlertDialog5Example },
	{ id: "c-alert-dialog-6", label: "Nested In Dialog", component: AlertDialog6Example },
	{ id: "c-alert-dialog-7", label: "Success Notice", component: AlertDialog7Example },
	{ id: "c-alert-dialog-8", label: "Account Deactivation", component: AlertDialog8Example },
	{ id: "c-alert-dialog-9", label: "Unsaved Changes", component: AlertDialog9Example },
	{ id: "c-alert-dialog-10", label: "E-Ticket Receipt", component: AlertDialog10Example },
	{ id: "c-alert-dialog-11", label: "System Update", component: AlertDialog11Example },
	{ id: "c-alert-dialog-12", label: "Billing Warning", component: AlertDialog12Example },
	{ id: "c-alert-dialog-13", label: "Logout Confirmation", component: AlertDialog13Example },
	{ id: "c-alert-dialog-14", label: "Security Audit", component: AlertDialog14Example },
];

export function AlertDialogExamples(): React.JSX.Element {
	return <ExampleGrid examples={ALERT_DIALOG_EXAMPLES} />;
}
