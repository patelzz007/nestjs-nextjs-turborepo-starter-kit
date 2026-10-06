import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";

/** The destructive-confirm wording of admin resource deletes; every other dialog string comes from the app's UI kit labels. */
export const ADMIN_RESOURCE_DELETE_DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = {
	confirm: "Delete",
	loading: "Deleting…",
};
