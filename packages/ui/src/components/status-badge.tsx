import { Badge, type BadgeProps, type BadgeVariant } from "@workspace/ui/components/badge";
import * as React from "react";

/**
 * What a status MEANS, independent of colour. Features declare a tone per
 * status (a pending review is `warning`, an approval is `success`); this module
 * alone decides how each tone looks, so every status pill in every app reads
 * the same way and a restyle is a one-line change.
 *
 * - `success` — done well / live / usable now
 * - `warning` — waiting on someone (a review, an action)
 * - `danger`  — failed, rejected, blocked
 * - `info`    — in progress, informational
 * - `neutral` — a settled state worth showing (e.g. redeemed, sent)
 * - `muted`   — inactive or finished and receding (draft, expired, completed)
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "muted";

export const STATUS_TONE_BADGE_VARIANT: Readonly<Record<StatusTone, BadgeVariant>> = {
	success: "success-light",
	warning: "warning-light",
	danger: "destructive-light",
	info: "info-light",
	neutral: "secondary",
	muted: "outline",
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
	readonly tone: StatusTone;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(function StatusBadge({ tone, ...props }, ref): React.ReactElement {
	return <Badge ref={ref} data-tone={tone} variant={STATUS_TONE_BADGE_VARIANT[tone]} {...props} />;
});
