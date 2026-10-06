import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface MerchantSurfacePanelProps {
	readonly children: React.ReactNode;
	readonly className?: string;
}

/**
 * A neutral card surface. It carries no emphasis of its own (no accent stripe,
 * no gradient): what matters inside it is signalled by its content — a status
 * badge's tone, the primary action — so every panel in the app reads as one family.
 */
export function MerchantSurfacePanel({ children, className }: MerchantSurfacePanelProps): React.JSX.Element {
	return <div className={cn("rounded-xl border border-border bg-card shadow-xs", className)}>{children}</div>;
}
