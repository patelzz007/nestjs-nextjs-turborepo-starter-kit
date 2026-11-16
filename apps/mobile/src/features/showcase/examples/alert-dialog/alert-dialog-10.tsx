import TicketIcon from "lucide-react-native/icons/ticket";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { DetailList, type DetailItem } from "@workspace/ui-native/components/detail-list";
import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

const MEDIA = <IconTile icon={TicketIcon} tone="green" size="md" />;
const ORDER: readonly DetailItem[] = [
	{ label: "Event", value: "Design Summit 2026" },
	{ label: "Date", value: "Fri, 4 Dec 2026" },
	{ label: "Seat", value: "Row F, seat 12" },
	{ label: "Order no.", value: "48213" },
	{ label: "Total", value: "$129.00" },
];

export function AlertDialog10Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Book ticket" variant="outline" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Booking confirmed"
				description="Your e-ticket was sent to ava@example.com."
				confirmLabel="Back to home"
				media={MEDIA}
				align="center">
				<DetailList items={ORDER} />
			</AlertDialog>
		</>
	);
}
