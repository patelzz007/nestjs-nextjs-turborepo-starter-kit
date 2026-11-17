"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { PromotionExportQuery } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Download } from "lucide-react";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";

/** Indentation of the saved file, so a reviewer can read it. */
const JSON_INDENT = 2;

/** Saves the live rules as a promotion file, to import into another environment (rule promotion). */
export function ExportRulesButton({ query }: { readonly query: PromotionExportQuery }): React.JSX.Element {
	const { api } = useAuth();
	const [busy, setBusy] = React.useState(false);
	const handleClick = React.useCallback(async (): Promise<void> => {
		setBusy(true);
		try {
			const file = await api.featureFlags.promotionExport.fetchOrThrow(query);
			const blob = new Blob([JSON.stringify(file.data, null, JSON_INDENT)], { type: "application/json" });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${query.key}.${file.data.environment}.r${String(file.data.revision)}.json`;
			link.click();
			URL.revokeObjectURL(link.href);
		} catch (error) {
			toastMutationError("Could not export the rules", error instanceof Error ? error : new Error(String(error)));
		} finally {
			setBusy(false);
		}
	}, [api, query]);
	const handlePress = React.useCallback((): void => {
		void handleClick();
	}, [handleClick]);
	return (
		<Button variant="outline" size="sm" disabled={busy} onClick={handlePress}>
			<Download className="size-4" />
			Export for another environment
		</Button>
	);
}
