import { X } from "lucide-react";
import type * as React from "react";

/** One id filter set from a link (actor, organization, correlation id …), shown as a removable chip above an audit table. */
export function IdFilterChip({ label, value, onClear }: { readonly label: string; readonly value: string; readonly onClear: () => void }): React.JSX.Element {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-input bg-muted px-2.5 py-1 text-xs">
			<span className="text-muted-foreground">{label}</span>
			<code className="max-w-40 truncate font-mono">{value}</code>
			<button type="button" onClick={onClear} aria-label={`Remove the ${label} filter`} className="rounded-full p-0.5 hover:bg-background">
				<X className="size-3" />
			</button>
		</span>
	);
}
