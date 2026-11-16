import { getFileType } from "@workspace/ui-kit-logic";
import { FileType } from "@workspace/ui-native/components/file-type";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import { Progress } from "@workspace/ui-native/components/progress";
import RotateCwIcon from "lucide-react-native/icons/rotate-cw";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Text, View } from "react-native";

import { formatFileSize } from "./file-type-sample";

type UploadStatus = "uploading" | "done" | "failed";

interface QueuedFile {
	readonly id: string;
	readonly name: string;
	readonly mime: string;
	readonly size: number;
	readonly progress: number;
	readonly status: UploadStatus;
}

const QUEUE: readonly QueuedFile[] = [
	{ id: "contract", name: "vendor-contract-2027.pdf", mime: "application/pdf", size: 2_140_000, progress: 100, status: "done" },
	{ id: "forecast", name: "q4-forecast.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 1_460_000, progress: 72, status: "uploading" },
	{ id: "walkthrough", name: "onboarding-walkthrough.mov", mime: "video/quicktime", size: 48_600_000, progress: 18, status: "uploading" },
	{ id: "assets", name: "brand-assets.zip", mime: "application/zip", size: 12_400_000, progress: 38, status: "failed" },
];

const COMPLETE_PERCENT = 100;

function QueueRow({
	file,
	onRemove,
	onRetry,
}: {
	readonly file: QueuedFile;
	readonly onRemove: (id: string) => void;
	readonly onRetry: (id: string) => void;
}): React.JSX.Element {
	const remove = React.useCallback((): void => {
		onRemove(file.id);
	}, [file.id, onRemove]);
	const retry = React.useCallback((): void => {
		onRetry(file.id);
	}, [file.id, onRetry]);
	return (
		<Item variant="outline" size="sm">
			<ItemMedia>
				<FileType type={getFileType(file.mime)} size="sm" />
			</ItemMedia>
			<ItemContent>
				<ItemTitle>{file.name}</ItemTitle>
				{file.status === "uploading" ? (
					<View className="h-4 flex-row items-center gap-2">
						<Progress value={file.progress} accessibilityLabel={`Uploading ${file.name}`} className="flex-1" />
						<Text className="text-caption w-8 text-right font-sans text-muted-foreground tabular-nums">{`${String(file.progress)}%`}</Text>
					</View>
				) : (
					<Text className="text-caption font-sans text-muted-foreground">
						{`${formatFileSize(file.size)} · `}
						{file.status === "done" ? "Uploaded" : <Text className="text-destructive-foreground">{`Failed at ${String(file.progress)}%`}</Text>}
					</Text>
				)}
			</ItemContent>
			<ItemActions>
				{file.status === "failed" ? <IconButton icon={RotateCwIcon} label={`Retry upload of ${file.name}`} variant="ghost" size="sm" onPress={retry} /> : null}
				{/* Cancelling a transfer and removing a result are different promises. */}
				<IconButton icon={XIcon} label={file.status === "uploading" ? `Cancel upload of ${file.name}` : `Remove ${file.name}`} variant="ghost" size="sm" onPress={remove} />
			</ItemActions>
		</Item>
	);
}

export function FileType8Example(): React.JSX.Element {
	const [files, setFiles] = React.useState<readonly QueuedFile[]>(QUEUE);
	const done = files.filter((file: QueuedFile): boolean => file.status === "done").length;
	const failed = files.filter((file: QueuedFile): boolean => file.status === "failed").length;
	const remove = React.useCallback((id: string): void => {
		setFiles((current: readonly QueuedFile[]): readonly QueuedFile[] => current.filter((file: QueuedFile): boolean => file.id !== id));
	}, []);
	const retry = React.useCallback((id: string): void => {
		setFiles((current: readonly QueuedFile[]): readonly QueuedFile[] =>
			current.map((file: QueuedFile): QueuedFile => (file.id === id ? { ...file, progress: COMPLETE_PERCENT, status: "done" } : file)),
		);
	}, []);
	return (
		<View className="gap-3">
			<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
				{files.length === 0 ? "No files in the queue." : `${String(done)} of ${String(files.length)} uploaded${failed > 0 ? `, ${String(failed)} failed` : ""}`}
			</Text>
			{files.length > 0 ? (
				<ItemGroup size="sm">
					{files.map((file: QueuedFile): React.JSX.Element => (
						<QueueRow key={file.id} file={file} onRemove={remove} onRetry={retry} />
					))}
				</ItemGroup>
			) : null}
		</View>
	);
}
