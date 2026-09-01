import { redirect } from "next/navigation";

/**
 * Settings landing route. The sidebar lists the parent item at `/settings` (a
 * toggle with children, so the sidebar never navigates here) — but if the URL
 * is hit directly, send the user to the General tab instead of a 404.
 * Server-side `redirect()` throws during render, so there is no client-side
 * flash or effect to manage.
 */
export default function SettingsPage(): never {
	redirect("/settings/general");
}
