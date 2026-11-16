import { Button } from "@workspace/ui-native/components/button";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import ArrowLeftRightIcon from "lucide-react-native/icons/arrow-left-right";
import CircleAlertIcon from "lucide-react-native/icons/circle-alert";
import FileSpreadsheetIcon from "lucide-react-native/icons/file-spreadsheet";
import ShareIcon from "lucide-react-native/icons/share";
import UsersIcon from "lucide-react-native/icons/users";
import * as React from "react";
import { AccessibilityInfo, Share } from "react-native";

interface RejectedRow {
	readonly row: number;
	readonly field: string;
	readonly problem: string;
}

const ERRORS: readonly RejectedRow[] = [
	{ row: 12, field: "email", problem: "Missing" },
	{ row: 87, field: "phone", problem: "Not a phone number" },
	{ row: 233, field: "email", problem: "Invalid domain" },
];

type ErrorColumn = "row" | "field" | "problem";

const ERROR_COLUMNS: readonly TableColumn<ErrorColumn>[] = [
	{ key: "row", label: "Row", align: "end" },
	{ key: "field", label: "Field" },
	{ key: "problem", label: "Problem" },
];

const ERROR_ROWS: readonly TableRow<ErrorColumn>[] = ERRORS.map((error: RejectedRow): TableRow<ErrorColumn> => ({
	key: String(error.row),
	cells: { row: String(error.row), field: error.field, problem: error.problem },
}));

const TOTAL = 2_404;

/** Rows the demo import adds on each tick, and how often it ticks. */
const IMPORT_BATCH_SIZE = 143;
const IMPORT_TICK_MS = 120;

const NUMBER_LOCALE = "en-US";
const TOTAL_LABEL = TOTAL.toLocaleString(NUMBER_LOCALE);

/** The rejected rows as a CSV, built from the sample data: nothing is fetched. */
const REJECTED_ROWS_CSV = ["row,field,problem", ...ERRORS.map((error: RejectedRow): string => `${String(error.row)},${error.field},${error.problem}`)].join("\n");

// The last step counts up in its description; rejected rows are a Table because they are scanned by row number.
export function Trace15Example(): React.JSX.Element {
	const [imported, setImported] = React.useState(0);
	const done = imported >= TOTAL;

	React.useEffect((): (() => void) | undefined => {
		if (done) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setImported((count: number): number => Math.min(count + IMPORT_BATCH_SIZE, TOTAL));
		}, IMPORT_TICK_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [imported, done]);

	// Only the end result is announced: every tick would flood a screen reader with numbers.
	React.useEffect((): void => {
		if (done) {
			AccessibilityInfo.announceForAccessibility(`Imported ${TOTAL_LABEL} contacts`);
		}
	}, [done]);

	// The phone's share sheet stands in for the web's download.
	const shareRejected = React.useCallback((): void => {
		Share.share({ title: "rejected-rows.csv", message: REJECTED_ROWS_CSV }).catch((): void => {
			// The share sheet could not open: nothing was sent.
		});
	}, []);

	const title = `${done ? "Imported" : "Importing"} ${TOTAL_LABEL} contacts`;
	return (
		<Trace accessibilityLabel="CSV import">
			<TraceLine icon={FileSpreadsheetIcon} title="Parsed contacts-october.csv" description="2,418 rows" />
			<TraceLine icon={ArrowLeftRightIcon} title="Mapped 8 of 9 columns" description="1 ignored" />
			<TraceStep icon={CircleAlertIcon} title="Rejected 14 invalid rows" status="error" defaultOpen>
				<Table caption="Rejected rows" columns={ERROR_COLUMNS} rows={ERROR_ROWS} size="sm" />
				<Button label="Share rejected rows as CSV" variant="link" size="xs" icon={ShareIcon} onPress={shareRejected} className="self-start" />
			</TraceStep>
			{/* The count is left out of the line's spoken name; the finished import is announced once. */}
			<TraceLine
				icon={UsersIcon}
				title={title}
				description={done ? "in 2.1s" : `${imported.toLocaleString(NUMBER_LOCALE)} of ${TOTAL_LABEL}`}
				accessibilityLabel={title}
				status={done ? undefined : "running"}
			/>
		</Trace>
	);
}
