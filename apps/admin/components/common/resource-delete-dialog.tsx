"use client";

import { ADMIN_RESOURCE_DELETE_DIALOG_LABELS } from "@/lib/resource-delete-dialog-labels";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogMedia,
	AlertDialogTitle,
	type AlertDialogLabels,
} from "@workspace/ui/components/overlay/alert-dialog";
import { Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export interface ResourceDeleteRequest {
	readonly title: string;
	readonly description: string;
	readonly count?: number;
	readonly onConfirm: () => void | Promise<void>;
}

export interface UseResourceDeleteDialogResult {
	readonly requestDelete: (request: ResourceDeleteRequest) => Promise<void>;
	readonly resourceDeleteDialog: React.JSX.Element;
}

export function useResourceDeleteDialog(labels: AlertDialogLabels = ADMIN_RESOURCE_DELETE_DIALOG_LABELS): UseResourceDeleteDialogResult {
	const [open, setOpen] = useState<boolean>(false);
	const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
	const [dialogState, setDialogState] = useState<ResourceDeleteRequest | null>(null);
	const resolveRef = useRef<(() => void) | null>(null);

	const finish = useCallback((): void => {
		resolveRef.current?.();
		resolveRef.current = null;
		setDialogState(null);
		setConfirmLoading(false);
		setOpen(false);
	}, []);

	const requestDelete = useCallback((request: ResourceDeleteRequest): Promise<void> => {
		return new Promise((resolve) => {
			resolveRef.current = resolve;
			setDialogState(request);
			setOpen(true);
		});
	}, []);

	const handleOpenChange = useCallback(
		(nextOpen: boolean): void => {
			if (nextOpen) {
				setOpen(true);
				return;
			}
			if (!confirmLoading) {
				finish();
			}
		},
		[confirmLoading, finish],
	);

	const handleConfirm = useCallback(async (): Promise<void> => {
		if (dialogState === null) {
			return;
		}
		setConfirmLoading(true);
		try {
			await dialogState.onConfirm();
			finish();
		} catch {
			setConfirmLoading(false);
		}
	}, [dialogState, finish]);

	const resourceDeleteDialog = (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent
				severity="critical"
				align="start"
				actionOrder="cancel-first"
				labels={labels}
				confirmLoading={confirmLoading}
				count={dialogState?.count}
				onConfirm={(): void => {
					void handleConfirm();
				}}>
				<AlertDialogMedia severity="critical">
					<Trash2 aria-hidden="true" />
				</AlertDialogMedia>
				<AlertDialogTitle>{dialogState?.title ?? ""}</AlertDialogTitle>
				<AlertDialogDescription>{dialogState?.description ?? ""}</AlertDialogDescription>
			</AlertDialogContent>
		</AlertDialog>
	);

	return { requestDelete, resourceDeleteDialog };
}
