"use client";

import { useParams } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { UserDetailBreadcrumb } from "@/components/users/user-detail-breadcrumb";

/** Zod schema (rule 13): the dynamic segment must be a non-empty id string. */
const UserIdSchema = z.string().regex(/^[a-zA-Z0-9-_]+$/);

/**
 * Data-driven breadcrumb demo — `/users/<id>`.
 *
 * The page is the **smart component** (rules 9–10): it owns the data (here a
 * deterministic mock user derived from the id; in a real app this would be an
 * API query) and hands the relevant pieces to low-level components via props.
 * `UserDetailBreadcrumb` receives only what it needs and wires it into the
 * breadcrumb context — it never fetches or mutates data itself.
 */
export default function UserDetailPage(): React.JSX.Element {
	const params = useParams<{ readonly id: string }>();
	const userId = params.id;
	if (!UserIdSchema.safeParse(userId).success) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">Invalid user id — the URL segment must be alphanumeric.</div>
		);
	}

	// DEMO data — owned by the page (rule 9). In a real app: fetch the user via
	// the typed `useApi` hook and pass `user.fullName` to the bridge.
	const displayName = `User ${userId}`;

	return (
		<div className="mx-auto w-full max-w-3xl space-y-6">
			{/* Smart bridge: overrides the trail with the entity's display name. */}
			<UserDetailBreadcrumb userId={userId} />

			<header>
				<div className="flex items-center gap-4">
					<div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">{displayName.slice(0, 1)}</div>
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground">{displayName}</h1>
						<p className="mt-0.5 text-sm text-muted-foreground">id: {userId}</p>
					</div>
				</div>
			</header>

			<div className="grid gap-4 sm:grid-cols-2">
				{[
					{ label: "Role", value: "Member" },
					{ label: "Status", value: "Active" },
					{ label: "Email", value: `${userId}@example.com` },
					{ label: "Created", value: "Jan 12, 2026" },
				].map((row) => (
					<div key={row.label} className="rounded-lg border bg-card p-4">
						<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{row.label}</p>
						<p className="mt-1 text-sm font-medium text-foreground">{row.value}</p>
					</div>
				))}
			</div>

			<p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
				This is a demo of the <strong>data-driven breadcrumb</strong> pattern: the resolver can only derive crumbs from the URL (&quot;Users › {userId}&quot;), so the page
				overrides the trail with the entity name via <code>setItems</code> and restores the route-derived trail on unmount (<code>reset</code>).
			</p>
		</div>
	);
}
