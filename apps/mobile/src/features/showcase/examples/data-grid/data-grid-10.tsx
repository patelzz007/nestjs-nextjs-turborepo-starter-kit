import { DataGridColumnHeader } from "@workspace/ui-native/components/data-grid-parts";
import MailIcon from "lucide-react-native/icons/mail";
import MapPinIcon from "lucide-react-native/icons/map-pin";
import UserIcon from "lucide-react-native/icons/user";
import * as React from "react";

import { COLUMN_WIDTH, EmailCell, LocationCell, PeopleGrid, PersonCell, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{
		accessorKey: "name",
		header: ({ column }) => <DataGridColumnHeader column={column} title="User" icon={UserIcon} />,
		cell: PersonCell,
		size: COLUMN_WIDTH.person,
		enableSorting: false,
	},
	{
		accessorKey: "email",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Email" icon={MailIcon} />,
		cell: EmailCell,
		size: COLUMN_WIDTH.email,
		enableSorting: false,
	},
	{
		accessorKey: "location",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Location" icon={MapPinIcon} />,
		cell: LocationCell,
		size: COLUMN_WIDTH.location,
		enableSorting: false,
	},
];

// An icon beside each title, with sorting off: every header is a plain label.
export function DataGrid10Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} />;
}
