import type { AlertDialogLabels } from "../components/overlay/alert-dialog";

/** Default alert-dialog copy for admin showcases and tests — apps pass their own labels in production. */
export const SHOWCASE_ALERT_DIALOG_LABELS: AlertDialogLabels = {
	confirm: "Confirm",
	cancel: "Cancel",
	loading: "Working…",
	close: "Close dialog",
	typeKeywordBefore: "Type",
	typeKeywordAfter: "to confirm",
	reasonLabel: "Reason (required)",
	reasonPlaceholder: "Explain why this change is needed…",
	dontAskAgain: "Don't ask again",
};
