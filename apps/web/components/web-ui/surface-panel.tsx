import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface WebSurfacePanelProps {
	readonly children: React.ReactNode;
	readonly className?: string;
	readonly accent?: boolean;
}

export function WebSurfacePanel({ children, className, accent = false }: WebSurfacePanelProps): React.JSX.Element {
	return <div className={cn("rounded-xl border border-border bg-card shadow-xs", accent ? "border-l-4 border-l-primary" : undefined, className)}>{children}</div>;
}
