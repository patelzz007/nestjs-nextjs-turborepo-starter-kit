"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";

import type { AccordionDemoItem } from "@/components/showcase/accordion-showcase";
import { ChartSkeleton } from "@/components/dashboard/chart-skeleton";
import { LazySection } from "@/components/common/lazy-section";
import { SectionCards } from "@/components/dashboard/section-cards";

// ── Lazy demo sections ────────────────────────────────────────────────────
// Every showcase below the fold (chart, table, accordion, …) is code-split so
// the initial bundle only contains the chrome + stat cards. Heavy deps
// (recharts, react-table, dnd-kit, react-hook-form, …) load in parallel with
// hydration instead of blocking first paint — LCP and TBT both drop. The
// `loading` skeletons reserve each section's height, so nothing jumps.

function SectionSkeleton({ height }: { readonly height: string }): React.JSX.Element {
	return <div role="status" aria-label="Loading section" className={cn("animate-pulse rounded-lg border bg-card", height)} />;
}

const tableSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-[400px]" />;
const breadcrumbSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-24" />;
const accordionSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-40" />;
const comboboxSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-48" />;
const selectSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-48" />;
const alertSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-40" />;
const toastSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-40" />;

// The chart sits right below the stat cards, so it loads immediately (its own
// chart-shaped skeleton shows while the recharts chunk downloads). Everything
// BELOW it is viewport-gated by `<LazySection>` and only mounts when scrolled
// near — the chunk then downloads on demand and the section fades in.
const ChartAreaInteractive = dynamic(() => import("@/components/dashboard/chart-area-interactive").then((m) => m.ChartAreaInteractive), {
	ssr: false,
	loading: ChartSkeleton,
});

const DataTableShowcase = dynamic(() => import("@/components/showcase/data-table-showcase").then((m) => m.DataTableShowcase), {
	ssr: false,
	loading: tableSectionLoading,
});

const AccordionShowcase = dynamic(() => import("@/components/showcase/accordion-showcase").then((m) => m.AccordionShowcase), {
	ssr: false,
	loading: accordionSectionLoading,
});

const BreadcrumbShowcase = dynamic(() => import("@/components/showcase/breadcrumb-showcase").then((m) => m.BreadcrumbShowcase), {
	ssr: false,
	loading: breadcrumbSectionLoading,
});

const ComboboxShowcase = dynamic(() => import("@/components/showcase/combobox-showcase").then((m) => m.ComboboxShowcase), {
	ssr: false,
	loading: comboboxSectionLoading,
});

const SelectShowcase = dynamic(() => import("@/components/showcase/select-showcase").then((m) => m.SelectShowcase), {
	ssr: false,
	loading: selectSectionLoading,
});

const AlertShowcase = dynamic(() => import("@/components/showcase/alert-showcase").then((m) => m.AlertShowcase), {
	ssr: false,
	loading: alertSectionLoading,
});

const ToastShowcase = dynamic(() => import("@/components/showcase/toast-showcase").then((m) => m.ToastShowcase), {
	ssr: false,
	loading: toastSectionLoading,
});

// ── Accordion demo data (rule 9/10: content lives at the page, the low-level
// components only receive props) ──────────────────────────────────────────────

const faqItems: readonly AccordionDemoItem[] = [
	{
		id: "faq-roles",
		value: "faq-roles",
		title: "How do roles and permissions work?",
		body: "Roles group permissions into named sets (e.g. Manager, Support). Every request is checked against the permission list on your access token, so revoking a role takes effect on the next refresh — not immediately.",
	},
	{
		id: "faq-sessions",
		value: "faq-sessions",
		title: "Why was I signed out of a session?",
		body: "Sessions rotate their refresh token on every renewal. If a token is ever reused — two tabs refreshing at the same instant, for example — the reuse-detection kicks in and all sessions for that account are revoked for safety.",
	},
	{
		id: "faq-two-factor",
		value: "faq-two-factor",
		title: "Is two-factor authentication supported?",
		body: "Not yet. The auth service already records device + IP metadata per session, so TOTP enrolment can be layered on top without schema changes. Tracked in docs/auth-roadmap.md.",
	},
	{
		id: "faq-deploy",
		value: "faq-deploy",
		title: "Can I deploy to my own VPS?",
		body: "Yes — the admin panel ships as a standalone Next.js build and the API as plain Nest ESM. Point PM2 or Docker at pnpm start:prod, set the env vars from .env.example, and you're live.",
		// Nested sub-topics — the showcase renders these as an inner accordion.
		children: [
			{
				id: "faq-deploy-docker",
				value: "faq-deploy-docker",
				title: "Docker or PM2?",
				body: "Both work. PM2 is the lightest path (pnpm start:prod per app); Docker is better when you want pinned Node versions and reproducible builds.",
			},
			{
				id: "faq-deploy-proxy",
				value: "faq-deploy-proxy",
				title: "What about the reverse proxy?",
				body: "Put Nginx or Caddy in front of :3001/:3000/:8080. TLS is terminated at the proxy; the apps themselves stay plain HTTP on localhost.",
			},
			{
				id: "faq-deploy-env",
				value: "faq-deploy-env",
				title: "Which env vars are required?",
				body: "DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, and the cookie config. Copy .env.example and fill in real secrets — never reuse dev values.",
			},
		],
	},
];

const statusItems: readonly AccordionDemoItem[] = [
	{
		id: "status-db",
		value: "status-db",
		title: "Database migrations applied",
		body: "12 migrations ran cleanly against the production database.",
		status: "done",
		count: 12,
		shortcut: "⌘1",
	},
	{
		id: "status-cache",
		value: "status-cache",
		title: "Warming the CDN cache",
		body: "Purging and re-warming the /docs routes… this row stays open while the job runs.",
		status: "loading",
		count: 3,
		shortcut: "⌘2",
	},
	{
		id: "status-env",
		value: "status-env",
		title: "Environment parity check",
		body: "STAGING and PRODUCTION differ on NEXT_PUBLIC_SESSION_POLL_MS — update the staging .env to match.",
		status: "error",
		count: 2,
		shortcut: "⌘3",
		autofocus: true,
	},
	{
		id: "status-lock",
		value: "status-lock",
		title: "Locked: requires super-admin",
		body: "This step is only available to super-admins; the trigger is disabled and not focusable.",
		disabled: true,
	},
	{
		id: "status-lazy",
		value: "status-lazy",
		title: "Lazy panel — mounts on first open",
		body: "This content is not in the DOM until you open it the first time (feature 11). Great for heavy panels that are rarely read.",
		lazy: true,
	},
];

const reorderItems: readonly AccordionDemoItem[] = [
	{
		id: "ord-api",
		value: "ord-api",
		title: "API gateway",
		body: "REST gateway on :8080 with cookie-based auth and swagger at /docs.",
	},
	{
		id: "ord-web",
		value: "ord-web",
		title: "Web app",
		body: "Public marketing + account site on :3000.",
	},
	{
		id: "ord-admin",
		value: "ord-admin",
		title: "Admin panel",
		body: "Internal panel on :3001 with proxy-side silent refresh.",
	},
	{
		id: "ord-worker",
		value: "ord-worker",
		title: "Background workers",
		body: "Prisma cron + email queue (Resend).",
	},
];

const variantItems: readonly AccordionDemoItem[] = [
	{
		id: "v-one",
		value: "v-one",
		title: "Compact list row",
		body: "size=sm with separated=false — sits flush inside dense tables.",
	},
	{
		id: "v-two",
		value: "v-two",
		title: "Plain ghost item",
		body: "variant=ghost — no borders, hover tint only.",
	},
	{
		id: "v-three",
		value: "v-three",
		title: "Flush, animation off",
		body: "variant=flush + animate={false} — for places where motion is unwanted.",
	},
	{
		id: "v-four",
		value: "v-four",
		title: "Bordered tile",
		body: "variant=bordered + size=lg with a custom Plus indicator via the icon slot.",
	},
];

/** Anchor targets for the in-page demo index — data lives at the page (rule 10). */
const DEMO_ANCHORS: readonly { readonly id: string; readonly label: string }[] = [
	{ id: "demo-chart", label: "Charts" },
	{ id: "demo-breadcrumbs", label: "Breadcrumbs" },
	{ id: "demo-table", label: "Table" },
	{ id: "demo-accordion", label: "Accordion" },
	{ id: "demo-combobox", label: "Combobox" },
	{ id: "demo-select", label: "Select" },
	{ id: "demo-alerts", label: "Alerts" },
	{ id: "demo-toasts", label: "Toasts" },
];

/**
 * Smooth-scrolls the app's scroll container (`main`) to a demo anchor. Uses
 * `scrollIntoView` rather than a `#hash` link so it works with the custom
 * `main` scroll container (no hash navigation, no `window.location` — SSR-safe).
 */
function scrollToDemo(id: string): void {
	document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Page(): React.JSX.Element {
	// Single delegated handler — reads the target id from the button's data
	// attribute, so the mapped buttons never bind per-item closures (rule 16).
	const handleDemoNav = React.useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const id = event.currentTarget.dataset.demoId;
		if (id !== undefined) {
			scrollToDemo(id);
		}
	}, []);

	return (
		<div className="@container/main flex flex-1 flex-col gap-2">
			<div className="flex flex-col gap-4 pt-4 pb-0 md:gap-6 md:pt-6 md:pb-0">
				{/* In-page demo index — the gallery sections sit far down the page, so
				    this makes every demo one click away instead of a 2.5-viewport scroll. */}
				<nav aria-label="Jump to component demos" className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
					<span className="text-xs font-medium text-muted-foreground">Jump to</span>
					{DEMO_ANCHORS.map((anchor) => (
						<Button key={anchor.id} type="button" size="sm" variant="outline" data-demo-id={anchor.id} onClick={handleDemoNav}>
							{anchor.label}
						</Button>
					))}
				</nav>

				<SectionCards />
				<div id="demo-chart" className="scroll-mt-4 px-4 lg:px-6">
					{/* Chart skeleton → real chart is an instant swap once the recharts
					    chunk resolves (standard dashboard behavior — the below-fold
					    sections get the fade/slide reveal animations instead). */}
					<ChartAreaInteractive />
				</div>
				<div id="demo-breadcrumbs" className="scroll-mt-4">
					<LazySection height="h-24">
						<BreadcrumbShowcase />
					</LazySection>
				</div>
				<div id="demo-table" className="scroll-mt-4">
					<LazySection height="h-[400px]">
						<DataTableShowcase />
					</LazySection>
				</div>
				<div id="demo-accordion" className="scroll-mt-4">
					<LazySection height="h-40">
						<AccordionShowcase faqItems={faqItems} statusItems={statusItems} reorderItems={reorderItems} variantItems={variantItems} />
					</LazySection>
				</div>
				<div id="demo-combobox" className="scroll-mt-4">
					<LazySection height="h-48">
						<ComboboxShowcase />
					</LazySection>
				</div>
				<div id="demo-select" className="scroll-mt-4">
					<LazySection height="h-48">
						<SelectShowcase />
					</LazySection>
				</div>
				<div id="demo-alerts" className="scroll-mt-4">
					<LazySection height="h-40">
						<AlertShowcase />
					</LazySection>
				</div>
				<div id="demo-toasts" className="scroll-mt-4">
					<LazySection height="h-40">
						<ToastShowcase />
					</LazySection>
				</div>

				{/* Deliberate page end — sits flush at the bottom of the scroll area (no
				    trailing padding), so the gallery ends cleanly instead of into a blank
				    band of the page background. */}
				<footer aria-hidden="true" className="flex items-center gap-4 px-4 pt-3 pb-1 lg:px-6">
					<div className="h-px flex-1 bg-border" />
					<span className="text-xs text-muted-foreground">End of component gallery</span>
					<div className="h-px flex-1 bg-border" />
				</footer>
			</div>
		</div>
	);
}
