"use client";

// ============================================
// components/telescope/stat-card.tsx
// Stat card for the Telescope overview. Fully dumb: label, value, sub-line
// and icon arrive via props; the accent (token-driven color) is the only
// optional styling knob.
// ============================================

import { Card, CardContent } from "@workspace/ui/components/display/card";
import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export interface StatCardProps {
	readonly label: string;
	/** `ReactNode` so pages can pass an animated `<AnimatedNumber />`. */
	readonly value: ReactNode;
	/** Optional secondary line (e.g. "p95 across the range"). */
	readonly sub?: string;
	readonly icon?: ReactNode;
	/** Icon accent color — token-driven (e.g. `text-emerald-500`). */
	readonly accentClass?: string;
	/** Optional link target when the card should navigate. */
	readonly href?: string;
	/** When this key changes, the icon pulses (e.g. a new error arriving). */
	readonly pulseKey?: number | string;
}

/**
 * StatCard — a single overview metric. `href` makes the whole card a link
 * (used for the "slowest request" drill-down); otherwise it is inert.
 * `pulseKey` re-triggers a subtle icon flash whenever its value changes.
 */
export function StatCard({ label, value, sub, icon, accentClass = "text-primary", href, pulseKey }: StatCardProps): React.JSX.Element {
	const body: React.JSX.Element = (
		<CardContent className="flex items-start justify-between gap-3 p-4">
			<div className="min-w-0">
				<p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
				<p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-foreground">{value}</p>
				{sub !== undefined ? <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p> : null}
			</div>
			{icon !== undefined ? (
				<motion.div
					key={pulseKey}
					initial={pulseKey !== undefined ? { scale: 0.85 } : false}
					animate={{ scale: 1 }}
					transition={{ type: "spring", stiffness: 320, damping: 16 }}
					className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60", accentClass)}>
					{icon}
				</motion.div>
			) : null}
		</CardContent>
	);

	if (href !== undefined) {
		return (
			<a href={href} className="block rounded-lg border bg-card text-card-foreground shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40">
				{body}
			</a>
		);
	}

	return <Card className="overflow-hidden shadow-xs">{body}</Card>;
}
