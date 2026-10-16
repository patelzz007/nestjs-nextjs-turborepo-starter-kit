import type { PaginationNavLabels } from "@workspace/ui/components/pagination";

// Shared sample copy for the Pagination examples. Every link points back at the
// gallery's own Pagination section, so following one never leaves the page.

/** The in-page target of every sample page link. */
export const PAGINATION_SAMPLE_HREF = "#component-pagination";

export const PAGINATION_PREVIOUS_TEXT = "Previous";
export const PAGINATION_NEXT_TEXT = "Next";
export const PAGINATION_MORE_PAGES_LABEL = "More pages";

export const PAGINATION_PREVIOUS_LABELS: Pick<PaginationNavLabels, "previousAria"> = { previousAria: "Go to the previous page" };
export const PAGINATION_NEXT_LABELS: Pick<PaginationNavLabels, "nextAria"> = { nextAria: "Go to the next page" };
