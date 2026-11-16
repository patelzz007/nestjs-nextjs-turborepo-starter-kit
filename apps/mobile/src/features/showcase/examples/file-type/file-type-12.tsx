import { Button } from "@workspace/ui-native/components/button";
import { FileType } from "@workspace/ui-native/components/file-type";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";
import { Text, View } from "react-native";
import { z } from "zod";

const ExportFormatSchema = z.enum(["pdf", "docx", "xlsx", "csv", "png"]);
type ExportFormat = z.infer<typeof ExportFormatSchema>;

const FORMATS: readonly { readonly value: ExportFormat; readonly title: string; readonly description: string }[] = [
	{ value: "pdf", title: "PDF document", description: "Fixed layout, ready to share or print" },
	{ value: "docx", title: "Word document", description: "Editable in Word or Google Docs" },
	{ value: "xlsx", title: "Excel workbook", description: "Every table on its own sheet" },
	{ value: "csv", title: "CSV table", description: "Plain rows for any data tool" },
	{ value: "png", title: "PNG images", description: "One image per page, for slides" },
];

const OPTIONS: readonly RadioOption<ExportFormat>[] = FORMATS.map((format): RadioOption<ExportFormat> => ({
	value: format.value,
	label: format.title,
	description: format.description,
	leading: <FileType type={format.value} />,
}));

export function FileType12Example(): React.JSX.Element {
	const [format, setFormat] = React.useState<ExportFormat | null>("pdf");
	const [exported, setExported] = React.useState<ExportFormat | null>(null);
	const exportFile = React.useCallback((): void => {
		setExported(format);
	}, [format]);
	const picked = format ?? "pdf";
	return (
		<View className="gap-4">
			<View className="gap-1">
				<Text className="text-label font-sans text-muted-foreground">Q3 revenue report, 24 pages.</Text>
				<RadioGroup label="Export format" options={OPTIONS} value={format} onChange={setFormat} />
			</View>
			<View className="flex-row items-center justify-between gap-3">
				{/* Exporting changes nothing on screen, so the result is announced. */}
				<Text accessibilityLiveRegion="polite" className="text-caption shrink font-sans text-muted-foreground">
					{exported === null ? "" : `Exported q3-revenue-report.${exported}`}
				</Text>
				<Button label={`Export ${picked.toUpperCase()}`} onPress={exportFile} />
			</View>
		</View>
	);
}
