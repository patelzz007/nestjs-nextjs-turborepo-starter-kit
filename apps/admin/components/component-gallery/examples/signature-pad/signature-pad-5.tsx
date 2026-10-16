"use client";

import { buttonVariants } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";
import { Frame, FramePanel } from "@workspace/ui/components/frame";
import {
	getSignaturePadBounds,
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	SignaturePadSave,
	type SignaturePadExportOptions,
	type SignaturePadFormat,
	type SignaturePadStroke,
} from "@workspace/ui/components/signature-pad";
import Image from "next/image";
import * as React from "react";

import { encodedSize, formatKilobytes } from "@/components/component-gallery/examples/signature-pad/signature-pad-example-helpers";

interface ExportFormat {
	readonly format: SignaturePadFormat;
	readonly label: string;
	readonly ext: string;
}

const FORMATS: readonly ExportFormat[] = [
	{ format: "png", label: "PNG", ext: "png" },
	{ format: "jpeg", label: "JPEG", ext: "jpg" },
	{ format: "svg", label: "SVG", ext: "svg" },
	{ format: "json", label: "JSON", ext: "json" },
];

interface ExportResult extends ExportFormat {
	readonly value: string;
	readonly width: number;
	readonly height: number;
}

/** Space kept around the ink in the exported file, in CSS pixels. */
const PADDING = 16;
/** Both sides of the ink carry the padding. */
const PADDED_SIDES = 2;
/** Size of the ink's bounding box when the pad is empty. */
const EMPTY_INK_SIZE = 0;
/**
 * The exported file's paper. This colours a downloaded image, not the UI, so
 * it is a literal: paper-white keeps the export readable whatever the theme.
 */
const EXPORT_PAPER_COLOR = "#ffffff";
const EXPORT_OPTIONS: SignaturePadExportOptions = { background: EXPORT_PAPER_COLOR, padding: PADDING };

/** The link a download of `result` points at: image exports are data URLs already. */
function downloadHref(result: ExportResult): string {
	return result.format === "json" ? `data:application/json;charset=utf-8,${encodeURIComponent(result.value)}` : result.value;
}

interface ExportButtonProps {
	readonly item: ExportFormat;
	readonly onExport: (result: ExportResult) => void;
}

function ExportButton({ item, onExport }: ExportButtonProps): React.JSX.Element {
	const handleSave = React.useCallback(
		(value: string, strokes: SignaturePadStroke[]): void => {
			const bounds = getSignaturePadBounds(strokes);
			onExport({
				...item,
				value,
				width: Math.ceil((bounds?.width ?? EMPTY_INK_SIZE) + PADDING * PADDED_SIDES),
				height: Math.ceil((bounds?.height ?? EMPTY_INK_SIZE) + PADDING * PADDED_SIDES),
			});
		},
		[item, onExport],
	);

	return (
		<SignaturePadSave format={item.format} options={EXPORT_OPTIONS} size="sm" onSave={handleSave}>
			{item.label}
		</SignaturePadSave>
	);
}

export function SignaturePad5Example(): React.JSX.Element {
	const [result, setResult] = React.useState<ExportResult | null>(null);
	const isImage = result !== null && result.format !== "json";

	const clearResult = React.useCallback((): void => {
		setResult(null);
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-4">
			<SignaturePad onValueChange={clearResult}>
				<SignaturePadArea className="h-44">
					<SignaturePadGuide />
					<SignaturePadPlaceholder />
				</SignaturePadArea>
				<div className="flex flex-wrap items-center gap-2">
					<ButtonGroup aria-label="Export format">
						<ButtonGroupText>Export</ButtonGroupText>
						{FORMATS.map((item: ExportFormat): React.JSX.Element => (
							<ExportButton key={item.format} item={item} onExport={setResult} />
						))}
					</ButtonGroup>
					<SignaturePadClear variant="ghost" size="sm" className="ms-auto">
						Clear
					</SignaturePadClear>
				</div>
			</SignaturePad>
			<p role="status" className="sr-only">
				{result ? `${result.label} ready, ${formatKilobytes(encodedSize(result.value))}` : null}
			</p>
			{result ? (
				<Frame spacing="sm">
					<FramePanel>
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2 text-sm">
								<span className="font-medium">{result.label}</span>
								<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
								<span className="text-muted-foreground">{formatKilobytes(encodedSize(result.value))}</span>
								<a href={downloadHref(result)} download={`signature.${result.ext}`} className={buttonVariants({ variant: "outline", size: "xs", className: "ms-auto" })}>
									Download
								</a>
							</div>
							{isImage ? (
								<Image
									src={result.value}
									alt={`Signature exported as ${result.label}`}
									width={result.width}
									height={result.height}
									unoptimized
									className="max-h-32 w-auto self-start"
								/>
							) : (
								<p className="line-clamp-3 font-mono text-xs break-all text-muted-foreground">{result.value}</p>
							)}
						</div>
					</FramePanel>
				</Frame>
			) : null}
		</div>
	);
}
