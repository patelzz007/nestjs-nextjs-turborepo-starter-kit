import type { AlertDialogLabels } from "@workspace/ui/components/overlay/alert-dialog";
import { SHOWCASE_ALERT_DIALOG_LABELS } from "@workspace/ui/lib/alert-dialog-labels";

/** Default destructive-confirm copy for admin resource deletes. */
export const ADMIN_RESOURCE_DELETE_DIALOG_LABELS: AlertDialogLabels = {
	...SHOWCASE_ALERT_DIALOG_LABELS,
	confirm: "Delete",
	loading: "Deleting…",
};
