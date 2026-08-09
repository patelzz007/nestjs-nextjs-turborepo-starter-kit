"use client";

import { Button } from "@workspace/ui/components/button";
import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { BreadcrumbTrail } from "@workspace/ui/components/breadcrumb-trail";
import { Activity, FileText, Home, LayoutDashboard, Settings, Shield, SlidersHorizontal, Users } from "lucide-react";
import * as React from "react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

// ── Demo data — content lives at the smart level (rules 9/10); the dumb
// trail only renders what it is given. Icons are mandatory on every crumb. ──

const demoTrailDefault: readonly BreadcrumbItem[] = [
	{ label: "Home", href: "/", icon: Home },
	{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
	{ label: "Analytics", icon: Activity },
];

const demoTrailLong: readonly BreadcrumbItem[] = [
	{ label: "Home", href: "/", icon: Home },
	{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
	{ label: "Analytics", href: "/analytics", icon: Activity },
	{ label: "Reports", href: "/analytics/reports", icon: FileText },
	{ label: "Marketing", href: "/analytics/reports/marketing", icon: Users },
	{ label: "Campaigns", icon: SlidersHorizontal },
];

const demoTrailSettings: readonly BreadcrumbItem[] = [
	{ label: "Settings", href: "/settings", icon: Settings },
	{ label: "Security", href: "/settings/security", icon: Shield },
	{ label: "Sessions", icon: Users },
];

type DemoStatus = "loading" | "error" | "ready";

interface DemoRowProps {
	readonly label: string;
	readonly children: React.ReactNode;
}

/** Labeled demo row. Callers neutralize the trail's baked-in `mb-6` with `-mb-6`. */
function DemoRow({ label, children }: DemoRowProps): React.JSX.Element {
	return (
		<div className="flex flex-col gap-2">
			<span className="text-xs font-medium text-muted-foreground">{label}</span>
			{children}
		</div>
	);
}

/** Smart breadcrumb demo — wires fake data + the state machine; the trail stays dumb. */
export function BreadcrumbShowcase(): React.JSX.Element {
	const [status, setStatus] = useState<DemoStatus>("ready");

	// Demo crumbs link nowhere — swallow navigation so the demo never leaves
	// the page (real apps pass Next.js `Link` instead).
	const preventDemoNavigation = useCallback((event: React.MouseEvent<HTMLAnchorElement>): void => {
		event.preventDefault();
	}, []);

	const renderDemoLink = useCallback(
		(item: BreadcrumbItem): React.ReactElement => {
			return <a href={item.href} onClick={preventDemoNavigation} />;
		},
		[preventDemoNavigation],
	);

	// Copy feedback goes through sonner — the admin app's globally-mounted
	// Toaster (same wiring as the dashboard layout's copy action).
	const handleCopy = useCallback((ok: boolean): void => {
		if (ok) {
			toast.success("Link copied", { description: "The page URL is on your clipboard." });
		} else {
			toast.error("Could not copy link", { description: "Copy the URL from the address bar instead." });
		}
	}, []);

	const handleRetry = useCallback((): void => {
		setStatus("ready");
	}, []);

	// Delegated status toggle — reads the target from `data-status` so the
	// three buttons never bind per-item closures (rule 16).
	const handleStatusChange = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const next = event.currentTarget.dataset.status;
		if (next === "loading" || next === "error" || next === "ready") {
			setStatus(next);
		}
	}, []);

	return (
		<section aria-labelledby="breadcrumb-gallery-title" className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs sm:p-6">
			<h2 id="breadcrumb-gallery-title" className="text-sm font-medium">
				Breadcrumbs
			</h2>
			<p className="mt-1 text-xs text-muted-foreground">
				Context-driven trails with mandatory icons — collapse with a hidden-crumbs popover, compact/scrollable variants, custom separators, copy-link, and loading/error
				states.
			</p>

			<div className="mt-5 space-y-6 border-t pt-4">
				<DemoRow label="Default trail">
					{/* `-mb-6` cancels the trail's baked-in bottom margin so the card's
					    own spacing (space-y-6) controls the rhythm. */}
					<div className="-mb-6">
						<BreadcrumbTrail items={demoTrailDefault} status="ready" renderLink={renderDemoLink} onCopy={handleCopy} />
					</div>
				</DemoRow>

				<DemoRow label="Collapsed — first + last 3, the middle hides in a popover">
					<div className="-mb-6">
						<BreadcrumbTrail items={demoTrailLong} status="ready" maxItems={4} renderLink={renderDemoLink} />
					</div>
				</DemoRow>

				<DemoRow label="Compact + scrollable (single line for dense page chrome)">
					<div className="-mb-6">
						<BreadcrumbTrail items={demoTrailLong} status="ready" size="sm" scrollable renderLink={renderDemoLink} />
					</div>
				</DemoRow>

				<DemoRow label="Custom separator (›)">
					<div className="-mb-6">
						<BreadcrumbTrail items={demoTrailSettings} status="ready" separator={<span>›</span>} renderLink={renderDemoLink} />
					</div>
				</DemoRow>

				<DemoRow label={`State — ${status}`}>
					<div className="flex flex-wrap items-center gap-3">
						<div className="-mb-6 min-w-0 flex-1">
							<BreadcrumbTrail
								items={status === "ready" ? demoTrailSettings : []}
								status={status}
								errorMessage="Could not resolve the session trail"
								onRetry={handleRetry}
								renderLink={renderDemoLink}
							/>
						</div>
						<div className="flex shrink-0 flex-wrap gap-2">
							<Button size="sm" variant={status === "ready" ? "default" : "outline"} data-status="ready" aria-pressed={status === "ready"} onClick={handleStatusChange}>
								Ready
							</Button>
							<Button size="sm" variant={status === "loading" ? "default" : "outline"} data-status="loading" aria-pressed={status === "loading"} onClick={handleStatusChange}>
								Loading
							</Button>
							<Button size="sm" variant={status === "error" ? "default" : "outline"} data-status="error" aria-pressed={status === "error"} onClick={handleStatusChange}>
								Error
							</Button>
						</div>
					</div>
				</DemoRow>
			</div>
		</section>
	);
}
