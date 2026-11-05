// @vitest-environment jsdom
// Enhancement 3.2: every core UI kit component, in its common states, has no serious or critical
// accessibility problem axe can find (see `src/testing/axe.ts` for what is and isn't checked here).
import { cleanup, render } from "@testing-library/react";
import { Bell } from "lucide-react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { accessibilityViolations } from "../../testing/axe";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { Alert, AlertDescription, AlertTitle } from "../alert";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "../alert-dialog";
import { Avatar, AvatarFallback } from "../avatar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../breadcrumb";
import { Button } from "../button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../card";
import { Checkbox } from "../checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../empty";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "../field";
import { Input } from "../input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "../input-group";
import { Label } from "../label";
import { ListPager } from "../list-pager";
import { NativeSelect, NativeSelectOption } from "../native-select";
import { Progress } from "../progress";
import { RadioGroup, RadioGroupItem } from "../radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { Skeleton } from "../skeleton";
import { StatusBadge } from "../status-badge";
import { Switch } from "../switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import { Textarea } from "../textarea";

const NOOP = (): void => undefined;
const FRUIT = [
	{ value: "apple", label: "Apple" },
	{ value: "pear", label: "Pear" },
];

/** One component in one state, rendered inside the kit's providers. */
interface AccessibilityCase {
	readonly name: string;
	readonly ui: React.ReactElement;
}

const CASES: readonly AccessibilityCase[] = [
	{
		name: "buttons, including an icon-only one with a label",
		ui: (
			<div>
				<Button>Save</Button>
				<Button variant="outline" disabled>
					Disabled
				</Button>
				<Button size="icon" aria-label="Notifications">
					<Bell aria-hidden="true" />
				</Button>
			</div>
		),
	},
	{
		name: "labelled text inputs, a textarea and an input group",
		ui: (
			<form>
				<Label htmlFor="a11y-name">Name</Label>
				<Input id="a11y-name" />
				<Field>
					<FieldLabel htmlFor="a11y-email">Email</FieldLabel>
					<Input id="a11y-email" type="email" aria-invalid aria-describedby="a11y-email-error" />
					<FieldDescription>We send the receipt here.</FieldDescription>
					<FieldError id="a11y-email-error">Enter an email address.</FieldError>
				</Field>
				<Label htmlFor="a11y-notes">Notes</Label>
				<Textarea id="a11y-notes" />
				<Label htmlFor="a11y-amount">Amount</Label>
				<InputGroup>
					<InputGroupAddon>
						<InputGroupText>RM</InputGroupText>
					</InputGroupAddon>
					<InputGroupInput id="a11y-amount" inputMode="decimal" />
				</InputGroup>
			</form>
		),
	},
	{
		name: "a checkbox, a switch and a radio group with their labels",
		ui: (
			<form>
				<div>
					<Checkbox id="a11y-terms" />
					<Label htmlFor="a11y-terms">I agree</Label>
				</div>
				<div>
					<Switch id="a11y-push" checked onCheckedChange={NOOP} />
					<Label htmlFor="a11y-push">Push notifications</Label>
				</div>
				<FieldSet>
					<FieldLegend>Delivery</FieldLegend>
					<RadioGroup defaultValue="pickup">
						<div>
							<RadioGroupItem id="a11y-pickup" value="pickup" />
							<Label htmlFor="a11y-pickup">Pick up</Label>
						</div>
						<div>
							<RadioGroupItem id="a11y-deliver" value="deliver" />
							<Label htmlFor="a11y-deliver">Deliver</Label>
						</div>
					</RadioGroup>
				</FieldSet>
			</form>
		),
	},
	{
		name: "a native select and the kit's select, closed and open",
		ui: (
			<form>
				<Label htmlFor="a11y-native">Country</Label>
				<NativeSelect id="a11y-native" defaultValue="my">
					<NativeSelectOption value="my">Malaysia</NativeSelectOption>
					<NativeSelectOption value="sg">Singapore</NativeSelectOption>
				</NativeSelect>
				<Label htmlFor="a11y-fruit">Fruit</Label>
				<Select items={FRUIT} defaultValue="apple" open>
					<SelectTrigger id="a11y-fruit">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{FRUIT.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</form>
		),
	},
	{
		name: "an open dialog",
		ui: (
			<Dialog open onOpenChange={NOOP}>
				<DialogContent>
					<DialogTitle>Rename store</DialogTitle>
					<DialogDescription>Customers see the new name straight away.</DialogDescription>
				</DialogContent>
			</Dialog>
		),
	},
	{
		name: "an open confirmation dialog",
		ui: (
			<AlertDialog open onOpenChange={NOOP}>
				<AlertDialogContent severity="critical" onConfirm={NOOP}>
					<AlertDialogTitle>Delete this reward?</AlertDialogTitle>
					<AlertDialogDescription>Customers who claimed it keep their codes.</AlertDialogDescription>
				</AlertDialogContent>
			</AlertDialog>
		),
	},
	{
		name: "tabs",
		ui: (
			<Tabs defaultValue="today">
				<TabsList>
					<TabsTrigger value="today">Today</TabsTrigger>
					<TabsTrigger value="week">This week</TabsTrigger>
				</TabsList>
				<TabsContent value="today">Today&apos;s numbers</TabsContent>
				<TabsContent value="week">This week&apos;s numbers</TabsContent>
			</Tabs>
		),
	},
	{
		name: "a table with a caption and headers",
		ui: (
			<Table>
				<TableCaption>Recent payments</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead>Customer</TableHead>
						<TableHead>Amount</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell>Aisyah</TableCell>
						<TableCell>RM 25.50</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		),
	},
	{
		name: "breadcrumbs and the list pager",
		ui: (
			<div>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/rewards">Rewards</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>Free coffee</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<ListPager page={2} totalPages={5} hasPrevious hasNext onPrevious={NOOP} onNext={NOOP} />
			</div>
		),
	},
	{
		name: "status pieces: alert, badge, progress, avatar, skeleton, empty state and card",
		ui: (
			<div>
				<Alert>
					<AlertTitle>Saved</AlertTitle>
					<AlertDescription>Your changes are live.</AlertDescription>
				</Alert>
				<StatusBadge tone="success">Paid</StatusBadge>
				<Progress value={40} aria-label="Upload progress" />
				<Avatar>
					<AvatarFallback>AJ</AvatarFallback>
				</Avatar>
				<Skeleton className="h-4 w-20" />
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No payments yet</EmptyTitle>
						<EmptyDescription>Ask for your first payment.</EmptyDescription>
					</EmptyHeader>
				</Empty>
				<Card>
					<CardHeader>
						<CardTitle>Today</CardTitle>
						<CardDescription>Since midnight</CardDescription>
					</CardHeader>
					<CardContent>12 claims</CardContent>
				</Card>
			</div>
		),
	},
];

afterEach((): void => {
	cleanup();
});

describe("UI kit accessibility (axe: serious and critical)", () => {
	it.each(CASES)("$name", async ({ ui }) => {
		render(ui, { wrapper: UiKitTestProviders });
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});
