import { Attachment, type AttachmentAction, type AttachmentState } from "@workspace/ui-native/components/attachment";
import CheckIcon from "lucide-react-native/icons/check";
import ClockIcon from "lucide-react-native/icons/clock";
import FileTextIcon from "lucide-react-native/icons/file-text";
import RotateCwIcon from "lucide-react-native/icons/rotate-cw";
import TriangleAlertIcon from "lucide-react-native/icons/triangle-alert";
import XIcon from "lucide-react-native/icons/x";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { View } from "react-native";

interface Row {
	readonly id: string;
	readonly name: string;
	readonly note: string;
	readonly state: AttachmentState;
}

const QUEUE: readonly Row[] = [
	{ id: "terms", name: "annual-plan-terms.pdf", note: "Ready to upload · 1.2 MB", state: "idle" },
	{ id: "replay", name: "session-replay.mp4", note: "Uploading · 62%", state: "uploading" },
	{ id: "chargebacks", name: "chargeback-export.csv", note: "Scanning for card numbers · 3.1 MB", state: "processing" },
	{ id: "ledger", name: "ledger-2024.xlsx", note: "Failed · connection dropped", state: "error" },
	{ id: "invoice", name: "invoice-3182.pdf", note: "Uploaded · 240 KB", state: "done" },
];

const ICONS: Readonly<Record<AttachmentState, LucideIcon>> = { idle: ClockIcon, uploading: ClockIcon, processing: FileTextIcon, error: TriangleAlertIcon, done: CheckIcon };

// Every upload state on its own row: queued (dashed), uploading (a spinner, cancel), processing, failed (retry), done.
export function Attachment5Example(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly Row[]>(QUEUE);
	return (
		<View className="w-full gap-2">
			{rows.map((row: Row): React.JSX.Element => (
				<QueueRow key={row.id} row={row} onChange={setRows} />
			))}
		</View>
	);
}

function QueueRow({ row, onChange }: { readonly row: Row; readonly onChange: React.Dispatch<React.SetStateAction<readonly Row[]>> }): React.JSX.Element {
	const retry = React.useCallback((): void => {
		onChange((current) => current.map((item: Row): Row => (item.id === row.id ? { ...item, state: "uploading", note: "Uploading · 0%" } : item)));
	}, [onChange, row.id]);
	const cancel = React.useCallback((): void => {
		onChange((current) => current.filter((item: Row): boolean => item.id !== row.id));
	}, [onChange, row.id]);
	const actions: readonly AttachmentAction[] =
		row.state === "error"
			? [{ key: "retry", label: `Retry ${row.name}`, icon: RotateCwIcon, onPress: retry }]
			: row.state === "uploading"
				? [{ key: "cancel", label: `Cancel ${row.name}`, icon: XIcon, onPress: cancel }]
				: [];
	return <Attachment name={row.name} description={row.note} icon={ICONS[row.state]} state={row.state} actions={actions} size="sm" className="w-full" />;
}
