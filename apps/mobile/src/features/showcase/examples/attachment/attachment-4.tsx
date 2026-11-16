import { Attachment } from "@workspace/ui-native/components/attachment";
import * as React from "react";
import { Text, View } from "react-native";

import { fileIcon } from "./attachment-sample";

// Three sizes for three levels of an answer: the deliverable, its working files, and its sources.
export function Attachment4Example(): React.JSX.Element {
	return (
		<View className="w-full gap-4">
			<View className="gap-1.5">
				<Text className="text-caption font-sans-medium text-muted-foreground">Deliverable</Text>
				<Attachment name="pricing-tiers-v4.xlsx" description="Spreadsheet · 412 KB" icon={fileIcon("pricing-tiers-v4.xlsx")} className="w-full" />
			</View>
			<View className="gap-1.5">
				<Text className="text-caption font-sans-medium text-muted-foreground">Working files</Text>
				<View className="flex-row flex-wrap gap-2">
					<Attachment name="churn-drivers.csv" description="88 KB" icon={fileIcon("churn-drivers.csv")} size="sm" />
					<Attachment name="rate-limits.md" description="4 KB" icon={fileIcon("rate-limits.md")} size="sm" />
				</View>
			</View>
			<View className="gap-1.5">
				<Text className="text-caption font-sans-medium text-muted-foreground">Sources</Text>
				<View className="flex-row flex-wrap gap-1.5">
					<Attachment name="invoice-3182.pdf" icon={fileIcon("invoice-3182.pdf")} size="xs" variant="muted" />
					<Attachment name="ledger-2024.xlsx" icon={fileIcon("ledger-2024.xlsx")} size="xs" variant="muted" />
				</View>
			</View>
		</View>
	);
}
