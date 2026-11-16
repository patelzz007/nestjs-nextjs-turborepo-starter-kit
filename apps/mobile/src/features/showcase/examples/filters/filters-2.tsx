import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import BoxIcon from "lucide-react-native/icons/box";
import CalendarIcon from "lucide-react-native/icons/calendar";
import HashIcon from "lucide-react-native/icons/hash";
import MapPinIcon from "lucide-react-native/icons/map-pin";
import TypeIcon from "lucide-react-native/icons/type";
import * as React from "react";

import { FilterBar } from "./filters-sample";

/** The record types the workspace holds, and how many attributes each carries. */
const RECORD_TYPES: readonly string[] = ["Company", "Contact", "Deal", "Ticket", "Invoice", "Product", "Project", "Task"];
const ATTRIBUTES_PER_TYPE = 250;
/** Every fifth attribute is a number, every seventh a date, every eleventh an address part. */
const NUMBER_EVERY = 5;
const DATE_EVERY = 7;
const ADDRESS_EVERY = 11;

/** A generated attribute: its kind picks its icon, and address parts answer to "zip" and "post code" too. */
function attribute(type: string, index: number): FilterBarField {
	const id = `${type.toLowerCase()}-${String(index + 1)}`;
	if (index % ADDRESS_EVERY === 0) {
		return { id, label: `${type} postcode ${String(index + 1)}`, type: "text", icon: MapPinIcon, keywords: ["zip", "post code"] };
	}
	if (index % DATE_EVERY === 0) {
		return { id, label: `${type} date ${String(index + 1)}`, type: "text", icon: CalendarIcon };
	}
	if (index % NUMBER_EVERY === 0) {
		return { id, label: `${type} amount ${String(index + 1)}`, type: "number", icon: HashIcon };
	}
	return { id, label: `${type} field ${String(index + 1)}`, type: "text", icon: TypeIcon };
}

/** Two thousand attributes under eight record types. */
const FIELDS: readonly FilterBarField[] = [
	{
		id: "attributes",
		label: "Attributes",
		icon: BoxIcon,
		fields: RECORD_TYPES.map((type: string): FilterBarField => ({
			id: type.toLowerCase(),
			label: type,
			fields: Array.from({ length: ATTRIBUTES_PER_TYPE }, (_, index: number): FilterBarField => attribute(type, index)),
		})),
	},
];

// Search the whole tree: "zip" finds every postcode, at any depth.
export function Filters2Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} />;
}
