import { notFound } from "next/navigation";

/**
 * Catch-all for every unmatched panel URL (e.g. `/whatever`). Calling
 * `notFound()` here bubbles up to the closest not-found boundary — the
 * `(panel)/not-found.tsx` — which renders **inside** the `(panel)` layout, so
 * the sidebar/topbar shell stays mounted and only the content area becomes
 * the 404 page. Without this file, an unknown URL would fall back to the root
 * `app/not-found.tsx` (no shell).
 */
export default function PanelCatchAll(): never {
	notFound();
}
