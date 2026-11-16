// The records the larger DataGrid examples work over, beside the sample people: employees with balances (the CRUD,
// footer and pinning examples), orders with line items (the sub-table), a department tree, a product sheet, long
// generated lists (infinite scroll, column virtualisation), and a simulated server that pages, sorts and filters.
// Sample data only, generated deterministically so every run shows the same rows.

import type { SortingState } from "@tanstack/react-table";

// ── Employees ──────────────────────────────────────────────────────────────

export type EmployeeStatus = "Active" | "Inactive" | "Pending" | "Blocked";

export const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = ["Active", "Inactive", "Pending", "Blocked"];

export interface Employee {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly role: string;
	readonly status: EmployeeStatus;
	readonly balance: number;
	readonly transactions: number;
}

const FIRST_NAMES: readonly string[] = ["Ava", "Liam", "Noah", "Mia", "Zara", "Omar", "Iris", "Kenji", "Lena", "Ravi", "Sofia", "Theo", "Nadia", "Hugo", "Priya", "Jonas"];
const LAST_NAMES: readonly string[] = ["Patel", "Chen", "Garcia", "Okafor", "Silva", "Kim", "Novak", "Haddad", "Ito", "Muller", "Rossi", "Tan"];
const ROLES: readonly string[] = ["Engineer", "Designer", "Product manager", "Analyst", "Support lead", "Marketing"];

/** Steps through the lists so neighbouring rows differ (prime strides). */
const NAME_STRIDE = 5;
const ROLE_STRIDE = 7;
const BALANCE_SEED = 1237;
const BALANCE_RANGE = 9000;
const BALANCE_FLOOR = 250;
const TRANSACTION_SEED = 37;
const TRANSACTION_RANGE = 180;
const CENTS = 100;

/** Wraps an index into a list of `length`. */
function cycle(index: number, length: number): number {
	return ((index % length) + length) % length;
}

/** The `index`-th generated employee. */
export function employeeAt(index: number): Employee {
	const first = FIRST_NAMES.at(cycle(index, FIRST_NAMES.length)) ?? "Ava";
	const last = LAST_NAMES.at(cycle(index * NAME_STRIDE, LAST_NAMES.length)) ?? "Patel";
	return {
		id: `emp-${String(index + 1)}`,
		name: `${first} ${last}`,
		email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
		role: ROLES.at(cycle(index * ROLE_STRIDE, ROLES.length)) ?? "Engineer",
		status: EMPLOYEE_STATUSES.at(cycle(index, EMPLOYEE_STATUSES.length)) ?? "Active",
		balance: Math.round((BALANCE_FLOOR + ((index * BALANCE_SEED) % BALANCE_RANGE)) * CENTS + index) / CENTS,
		transactions: (index * TRANSACTION_SEED) % TRANSACTION_RANGE,
	};
}

export const EMPLOYEE_COUNT = 12;
export const EMPLOYEES: readonly Employee[] = Array.from({ length: EMPLOYEE_COUNT }, (_, index: number): Employee => employeeAt(index));

export function employeeId(employee: Employee): string {
	return employee.id;
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function formatUsd(amount: number): string {
	return USD.format(amount);
}

// ── Summary statistics ─────────────────────────────────────────────────────

export interface Summary {
	readonly sum: number;
	readonly min: number;
	readonly max: number;
	readonly average: number;
}

/** Total, lowest, highest and mean of `values` (all zero for none). */
export function summarize(values: readonly number[]): Summary {
	if (values.length === 0) {
		return { sum: 0, min: 0, max: 0, average: 0 };
	}
	const sum = values.reduce((total: number, value: number): number => total + value, 0);
	return { sum, min: Math.min(...values), max: Math.max(...values), average: sum / values.length };
}

// ── Orders ─────────────────────────────────────────────────────────────────

export interface OrderItem {
	readonly id: string;
	readonly product: string;
	readonly category: string;
	readonly price: number;
	readonly quantity: number;
}

export type OrderStatus = "Paid" | "Shipped" | "Pending" | "Refunded";

export interface Order {
	readonly id: string;
	readonly number: string;
	readonly customer: string;
	readonly status: OrderStatus;
	readonly items: readonly OrderItem[];
}

const PRODUCTS: readonly { readonly name: string; readonly category: string; readonly price: number }[] = [
	{ name: "Wireless earbuds", category: "Audio", price: 129 },
	{ name: "Mechanical keyboard", category: "Accessories", price: 89.5 },
	{ name: "4K monitor", category: "Displays", price: 349 },
	{ name: "USB-C hub", category: "Accessories", price: 39.99 },
	{ name: "Smart watch", category: "Wearables", price: 199 },
	{ name: "Desk lamp", category: "Home office", price: 45 },
	{ name: "Webcam", category: "Video", price: 74.9 },
];
const ORDER_STATUSES: readonly OrderStatus[] = ["Paid", "Shipped", "Pending", "Refunded"];
const ORDER_COUNT = 6;
const ITEMS_BASE = 2;
const ITEMS_SPREAD = 4;
const ORDER_NUMBER_BASE = 10_240;
const MAX_QUANTITY = 3;

export const ORDERS: readonly Order[] = Array.from({ length: ORDER_COUNT }, (_, index: number): Order => {
	const customer = employeeAt(index + EMPLOYEE_COUNT).name;
	return {
		id: `order-${String(index + 1)}`,
		number: `#${String(ORDER_NUMBER_BASE + index)}`,
		customer,
		status: ORDER_STATUSES.at(cycle(index, ORDER_STATUSES.length)) ?? "Paid",
		items: Array.from({ length: ITEMS_BASE + cycle(index * ROLE_STRIDE, ITEMS_SPREAD) }, (_unused, item: number): OrderItem => {
			const product = PRODUCTS.at(cycle(index + item * NAME_STRIDE, PRODUCTS.length)) ?? { name: "Item", category: "Other", price: 1 };
			return {
				id: `order-${String(index + 1)}-item-${String(item + 1)}`,
				product: product.name,
				category: product.category,
				price: product.price,
				quantity: 1 + cycle(index + item, MAX_QUANTITY),
			};
		}),
	};
});

export function orderTotal(order: Order): number {
	return order.items.reduce((total: number, item: OrderItem): number => total + item.price * item.quantity, 0);
}

// ── A department tree ──────────────────────────────────────────────────────

export interface TreeNode {
	readonly id: string;
	readonly name: string;
	readonly kind: "department" | "team" | "member";
	readonly role?: string | undefined;
	readonly children?: readonly TreeNode[] | undefined;
}

const DEPARTMENTS: readonly { readonly name: string; readonly teams: readonly string[] }[] = [
	{ name: "Engineering", teams: ["Platform", "Mobile"] },
	{ name: "Design", teams: ["Product design", "Brand"] },
	{ name: "Operations", teams: ["Support", "Finance"] },
	{ name: "Sales", teams: ["Enterprise"] },
	{ name: "People", teams: ["Recruiting"] },
];
const MEMBERS_PER_TEAM = 2;

export const ORG_TREE: readonly TreeNode[] = DEPARTMENTS.map((department, d: number): TreeNode => ({
	id: `dept-${String(d + 1)}`,
	name: department.name,
	kind: "department",
	children: department.teams.map((team: string, t: number): TreeNode => ({
		id: `dept-${String(d + 1)}-team-${String(t + 1)}`,
		name: team,
		kind: "team",
		children: Array.from({ length: MEMBERS_PER_TEAM }, (_, m: number): TreeNode => {
			const person = employeeAt(d * NAME_STRIDE + t * MEMBERS_PER_TEAM + m);
			return { id: `dept-${String(d + 1)}-team-${String(t + 1)}-member-${String(m + 1)}`, name: person.name, kind: "member", role: person.role };
		}),
	})),
}));

export function treeChildren(node: TreeNode): readonly TreeNode[] | undefined {
	return node.children;
}

// ── A product sheet ────────────────────────────────────────────────────────

export type ProductStatus = "In stock" | "Low stock" | "Sold out";

export interface Product {
	readonly id: string;
	readonly sku: string;
	readonly name: string;
	readonly stock: number;
	readonly price: number;
	readonly status: ProductStatus;
}

const LOW_STOCK = 10;

/** A product's status from its stock: none is sold out, under ten is low. */
export function productStatus(stock: number): ProductStatus {
	return stock <= 0 ? "Sold out" : stock < LOW_STOCK ? "Low stock" : "In stock";
}

const STOCK_LEVELS: readonly number[] = [42, 7, 0, 18, 3, 64, 25];

export const PRODUCT_SHEET: readonly Product[] = PRODUCTS.map((product, index: number): Product => {
	const stock = STOCK_LEVELS.at(index) ?? 0;
	return { id: `sku-${String(index + 1)}`, sku: `SKU-${String(index + 1).padStart(3, "0")}`, name: product.name, stock, price: product.price, status: productStatus(stock) };
});

/** A typed number from a cell's text ("1,200", " 8 "), or `undefined` when it is not one. */
export function parseCount(raw: string): number | undefined {
	const text = raw.replaceAll(",", "").trim();
	const value = Number(text);
	return text === "" || !Number.isFinite(value) ? undefined : value;
}

// ── Long lists ─────────────────────────────────────────────────────────────

export interface LogRow {
	readonly id: string;
	readonly index: number;
	readonly name: string;
	readonly email: string;
	readonly balance: number;
}

export function logRowAt(index: number): LogRow {
	const person = employeeAt(index);
	return { id: `row-${String(index + 1)}`, index: index + 1, name: person.name, email: person.email, balance: person.balance };
}

export const LOCAL_ROW_COUNT = 200;
export const LOCAL_ROWS: readonly LogRow[] = Array.from({ length: LOCAL_ROW_COUNT }, (_, index: number): LogRow => logRowAt(index));

export function logRowId(row: LogRow): string {
	return row.id;
}

/** One page of a feed a server would send; `null` once there is nothing more. */
export interface FeedPage {
	readonly rows: readonly LogRow[];
	readonly next: number | null;
}

export const FEED_TOTAL = 60;

/** The rows from `cursor`, `size` of them. */
export function feedPage(cursor: number, size: number): FeedPage {
	const end = Math.min(FEED_TOTAL, cursor + size);
	return { rows: Array.from({ length: Math.max(0, end - cursor) }, (_, offset: number): LogRow => logRowAt(cursor + offset)), next: end >= FEED_TOTAL ? null : end };
}

// ── A wide matrix ──────────────────────────────────────────────────────────

export const METRIC_ROW_COUNT = 1000;
export const METRIC_COLUMN_COUNT = 36;
const METRIC_ROW_SEED = 31;
const METRIC_COLUMN_SEED = 17;
const METRIC_RANGE = 1000;

export interface MetricRow {
	readonly id: string;
	readonly index: number;
}

export const METRIC_ROWS: readonly MetricRow[] = Array.from({ length: METRIC_ROW_COUNT }, (_, index: number): MetricRow => ({ id: `m-${String(index + 1)}`, index }));

/** One cell of the matrix: a stable figure for a row and a metric. */
export function metricValue(row: number, column: number): number {
	return ((row + 1) * METRIC_ROW_SEED + (column + 1) * METRIC_COLUMN_SEED * (row % METRIC_COLUMN_SEED)) % METRIC_RANGE;
}

// ── A server that pages ────────────────────────────────────────────────────

export const SERVER_RECORD_COUNT = 48;
export const SERVER_RECORDS: readonly Employee[] = Array.from({ length: SERVER_RECORD_COUNT }, (_, index: number): Employee => employeeAt(index));

export interface ServerRequest {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly sorting: SortingState;
	readonly search: string;
	readonly status: EmployeeStatus | null;
}

export interface ServerResponse {
	readonly rows: readonly Employee[];
	readonly total: number;
}

type SortableKey = "name" | "role" | "balance";

function compareBy(key: SortableKey, a: Employee, b: Employee): number {
	return key === "balance" ? a.balance - b.balance : a[key].localeCompare(b[key]);
}

function isSortableKey(id: string): id is SortableKey {
	return id === "name" || id === "role" || id === "balance";
}

/** What the server answers: the records matching the search and status, sorted, one page of them. */
export function answerServerRequest(request: ServerRequest, records: readonly Employee[] = SERVER_RECORDS): ServerResponse {
	const needle = request.search.trim().toLowerCase();
	const matching = records.filter(
		(record: Employee): boolean =>
			(needle === "" || record.name.toLowerCase().includes(needle) || record.email.includes(needle)) && (request.status === null || record.status === request.status),
	);
	const [sort] = request.sorting;
	const key = sort === undefined || !isSortableKey(sort.id) ? null : sort.id;
	const direction = sort?.desc === true ? -1 : 1;
	const sorted = key === null ? matching : [...matching].sort((a: Employee, b: Employee): number => direction * compareBy(key, a, b));
	const start = request.pageIndex * request.pageSize;
	return { rows: sorted.slice(start, start + request.pageSize), total: matching.length };
}

/** How long the simulated server takes to answer. */
export const SERVER_LATENCY_MS = 450;

export function fetchServerPage(request: ServerRequest): Promise<ServerResponse> {
	return new Promise((resolve: (response: ServerResponse) => void): void => {
		setTimeout((): void => {
			resolve(answerServerRequest(request));
		}, SERVER_LATENCY_MS);
	});
}
