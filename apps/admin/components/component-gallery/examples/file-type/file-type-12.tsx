"use client";

import * as React from "react";
import { useCallback, useId, useState } from "react";
import { z } from "zod";
import { FileType } from "@workspace/ui/components/file-type";

import { Button } from "@workspace/ui/components/button";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

/** The export formats; also parses the radio group's untyped value back into one. */
const ExportFormatSchema = z.enum(["pdf", "docx", "xlsx", "csv", "png"]);
type ExportFormat = z.infer<typeof ExportFormatSchema>;
type RadioValueChange = NonNullable<React.ComponentProps<typeof RadioGroup>["onValueChange"]>;

const FORMATS: {
	value: ExportFormat;
	title: string;
	description: string;
}[] = [
	{
		value: "pdf",
		title: "PDF document",
		description: "Fixed layout, ready to share or print",
	},
	{
		value: "docx",
		title: "Word document",
		description: "Editable in Word or Google Docs",
	},
	{
		value: "xlsx",
		title: "Excel workbook",
		description: "Every table on its own sheet",
	},
	{
		value: "csv",
		title: "CSV table",
		description: "Plain rows for any data tool",
	},
	{
		value: "png",
		title: "PNG images",
		description: "One image per page, for slides",
	},
];

export function FileType12Example(): React.JSX.Element {
	// A prefix from useId keeps every label paired with its own radio when the
	// picker renders more than once on a page.
	const id = useId();
	// Preselected on purpose: an export always needs a format, so there is no
	// empty state worth showing.
	const [format, setFormat] = useState<ExportFormat>("pdf");
	const [exported, setExported] = useState<ExportFormat | null>(null);

	const handleFormatChange = useCallback<RadioValueChange>((value): void => {
		const parsed = ExportFormatSchema.safeParse(value);
		if (parsed.success) {
			setFormat(parsed.data);
		}
	}, []);
	const handleExport = useCallback((): void => {
		setExported(format);
	}, [format]);

	return (
		<FieldSet className="mx-auto w-full max-w-sm">
			<FieldLegend>Export format</FieldLegend>
			<FieldDescription>Q3 revenue report, 24 pages.</FieldDescription>
			{/* The group reports a plain value, narrowed back to the union here. */}
			<RadioGroup value={format} onValueChange={handleFormatChange}>
				{FORMATS.map((option) => (
					<FieldLabel key={option.value} htmlFor={`${id}-${option.value}`}>
						<Field orientation="horizontal">
							{/*
							 * The icon keeps its own accessible name ("DOCX file"): the
							 * title beside it is a plain name, not the extension.
							 */}
							<FileType type={option.value} />
							<FieldContent>
								<FieldTitle>{option.title}</FieldTitle>
								<FieldDescription>{option.description}</FieldDescription>
							</FieldContent>
							<RadioGroupItem value={option.value} id={`${id}-${option.value}`} />
						</Field>
					</FieldLabel>
				))}
			</RadioGroup>
			<div className="flex items-center justify-between gap-3">
				{/* Exporting changes nothing on screen, so the result is announced here. */}
				<p role="status" className="min-w-0 text-xs text-muted-foreground">
					{exported ? `Exported q3-revenue-report.${exported}` : null}
				</p>
				<Button type="button" onClick={handleExport}>
					Export {format.toUpperCase()}
				</Button>
			</div>
		</FieldSet>
	);
}
