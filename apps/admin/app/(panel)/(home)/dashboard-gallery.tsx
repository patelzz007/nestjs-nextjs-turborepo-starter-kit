"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { Button } from "@workspace/ui/components/button";

import { LazySection } from "@/components/common/lazy-section";
import { PlatformSalesCards } from "@/components/dashboard/platform-sales-cards";
import { SectionSkeleton } from "@/components/loading/section-skeleton";
import { ACCORDION_FAQ_ITEMS, ACCORDION_REORDER_ITEMS, ACCORDION_STATUS_ITEMS, ACCORDION_VARIANT_ITEMS } from "@/components/showcase/accordion-demo-items";

// ── Lazy demo sections ────────────────────────────────────────────────────
// Every showcase below the fold (chart, table, accordion, …) is code-split so
// the initial bundle only contains the chrome + platform sales cards. Heavy deps
// (recharts, react-table, dnd-kit, react-hook-form, …) load in parallel with
// hydration instead of blocking first paint — LCP and TBT both drop. The
// `loading` skeletons reserve each section's height, so nothing jumps.

const tableSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-[400px]" />;
const breadcrumbSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-24" />;
const accordionSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-40" />;
const comboboxSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-48" />;
const selectSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-48" />;
const alertSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-40" />;
const toastSectionLoading = (): React.JSX.Element => <SectionSkeleton height="h-40" />;

// Every gallery section is viewport-gated by `<LazySection>` and only mounts
// when scrolled near — the chunk then downloads on demand and the section fades in.
const DataTableShowcase = dynamic(() => import("@/components/showcase/data-table-showcase").then((m) => m.DataTableShowcase), {
	loading: tableSectionLoading,
});

const AccordionShowcase = dynamic(() => import("@/components/showcase/accordion-showcase").then((m) => m.AccordionShowcase), {
	loading: accordionSectionLoading,
});

const BreadcrumbShowcase = dynamic(() => import("@/components/showcase/breadcrumb-showcase").then((m) => m.BreadcrumbShowcase), {
	loading: breadcrumbSectionLoading,
});

const ComboboxShowcase = dynamic(() => import("@/components/showcase/combobox-showcase").then((m) => m.ComboboxShowcase), {
	loading: comboboxSectionLoading,
});

const SelectShowcase = dynamic(() => import("@/components/showcase/select-showcase").then((m) => m.SelectShowcase), {
	loading: selectSectionLoading,
});

const AlertShowcase = dynamic(() => import("@/components/showcase/alert-showcase").then((m) => m.AlertShowcase), {
	loading: alertSectionLoading,
});

const ToastShowcase = dynamic(() => import("@/components/showcase/toast-showcase").then((m) => m.ToastShowcase), {
	loading: toastSectionLoading,
});

/** Anchor targets for the in-page demo index — data lives at the page (rule 10). */
const DEMO_ANCHORS: readonly { readonly id: string; readonly label: string }[] = [
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

export interface DashboardGalleryProps {
	/** Whether this deployment serves the developer component gallery (`isComponentGalleryEnabled`, decided on the server). */
	readonly showComponentGallery: boolean;
}

export default function Page({ showComponentGallery }: DashboardGalleryProps): React.JSX.Element {
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
				{showComponentGallery ? (
					<nav aria-label="Jump to component demos" className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
						<span className="text-xs font-medium text-muted-foreground">Jump to</span>
						{DEMO_ANCHORS.map((anchor) => (
							<Button key={anchor.id} type="button" size="sm" variant="outline" data-demo-id={anchor.id} onClick={handleDemoNav}>
								{anchor.label}
							</Button>
						))}
					</nav>
				) : null}

				<PlatformSalesCards />
				{showComponentGallery ? <ComponentGallerySamples /> : null}
			</div>
		</div>
	);
}

/**
 * The UI kit's component gallery on the landing page: sample content that demonstrates the components,
 * never live platform data. A developer tool, so a deployment without the gallery shows the overview only.
 */
function ComponentGallerySamples(): React.JSX.Element {
	return (
		<>
			<header className="px-4 lg:px-6">
				<h2 className="text-base font-semibold tracking-tight text-foreground">Component gallery</h2>
				<p className="text-sm text-muted-foreground">UI kit examples with sample content — not live platform data.</p>
			</header>
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
					<AccordionShowcase
						faqItems={ACCORDION_FAQ_ITEMS}
						statusItems={ACCORDION_STATUS_ITEMS}
						reorderItems={ACCORDION_REORDER_ITEMS}
						variantItems={ACCORDION_VARIANT_ITEMS}
					/>
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
		</>
	);
}
