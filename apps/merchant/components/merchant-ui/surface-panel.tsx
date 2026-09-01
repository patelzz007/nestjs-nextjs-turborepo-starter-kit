import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface MerchantSurfacePanelProps {
	readonly children: React.ReactNode;
	readonly className?: string;
	readonly accent?: boolean;
}

/** Card-like panel with optional left accent stripe — no gradients. */
export function MerchantSurfacePanel({ children, className, accent = false }: MerchantSurfacePanelProps): React.JSX.Element {
	return <div className={cn("rounded-xl border border-border bg-card shadow-xs", accent ? "border-l-4 border-l-primary" : undefined, className)}>{children}</div>;
}
