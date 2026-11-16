import UploadIcon from "lucide-react-native/icons/upload";
import { Button } from "@workspace/ui-native/components/button";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";
import { View } from "react-native";
import { formatFileSize, useFileUpload, type UploadFile } from "@workspace/ui-native/lib/use-file-upload";

import { useSimulatedUploads } from "./file-upload-simulation";

const PERCENT = 100;

type Column = "name" | "type" | "size" | "status";

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "name", label: "Name" },
	{ key: "type", label: "Type" },
	{ key: "size", label: "Size", align: "end" },
	{ key: "status", label: "Status", align: "end" },
];

/** One file as a row: its name, type, size and where its upload is. */
function rowOf(file: UploadFile): TableRow<Column> {
	return {
		key: file.id,
		cells: {
			name: file.name,
			type: file.mimeType ?? "—",
			size: file.size === null ? "—" : formatFileSize(file.size),
			status: file.status === "done" ? "Done" : `${String(Math.round((file.progress ?? 0) * PERCENT))}%`,
		},
	};
}

export function FileUpload6Example(): React.JSX.Element {
	const upload = useFileUpload({ maxFiles: 10 });
	useSimulatedUploads(upload);
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was picked.
		});
	}, [upload]);
	return (
		<View className="gap-3">
			<Button label="Add files" icon={UploadIcon} variant="outline" size="sm" onPress={choose} className="self-start" />
			<Table caption="Files" columns={COLUMNS} rows={upload.files.map(rowOf)} />
		</View>
	);
}
