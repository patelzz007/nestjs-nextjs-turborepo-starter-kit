"use client";

import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/display/table";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Check, CreditCard, Download, Sparkles } from "lucide-react";
import * as React from "react";

/** A single plan feature bullet — data lives at the page level. */
interface PlanFeature {
	readonly label: string;
	readonly included: boolean;
}

/** A single invoice row rendered in the invoices table. */
interface Invoice {
	readonly id: string;
	readonly date: string;
	readonly amount: string;
	readonly status: "Paid" | "Pending" | "Failed";
}

const planFeatures: readonly PlanFeature[] = [
	{ label: "Up to 10 team members", included: true },
	{ label: "Unlimited projects", included: true },
	{ label: "Advanced analytics", included: true },
	{ label: "Priority support", included: true },
	{ label: "Custom integrations", included: false },
	{ label: "SLA & dedicated manager", included: false },
];

const invoices: readonly Invoice[] = [
	{ id: "INV-1045", date: "Jul 01, 2026", amount: "$49.00", status: "Paid" },
	{ id: "INV-1044", date: "Jun 01, 2026", amount: "$49.00", status: "Paid" },
	{ id: "INV-1043", date: "May 01, 2026", amount: "$49.00", status: "Paid" },
	{ id: "INV-1042", date: "Apr 01, 2026", amount: "$49.00", status: "Pending" },
	{ id: "INV-1041", date: "Mar 01, 2026", amount: "$49.00", status: "Failed" },
];

const statusVariant: Readonly<Record<Invoice["status"], "default" | "secondary" | "destructive">> = {
	Paid: "default",
	Pending: "secondary",
	Failed: "destructive",
};

export default function BillingSettingsView(): React.JSX.Element {
	const handleUpgrade = React.useCallback((): void => {
		toastMessage.info({ title: "Upgrade plan", description: "Plan upgrade is not available yet." });
	}, []);

	const handleDownloadInvoice = React.useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const invoiceId = event.currentTarget.dataset.invoiceId;
		if (invoiceId !== undefined) {
			toastMessage.success({ title: "Invoice downloaded", description: `${invoiceId} has been downloaded.` });
		}
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
				<p className="mt-1 text-sm text-muted-foreground">Manage your subscription, payment method, and invoices.</p>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* Current plan */}
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Current Plan</CardTitle>
						<CardDescription>You are currently on the Pro plan.</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-center gap-3">
								<div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
									<Sparkles className="size-5 text-primary" />
								</div>
								<div>
									<p className="text-lg font-semibold text-foreground">Pro Plan</p>
									<p className="text-sm text-muted-foreground">$49.00 / month · billed monthly</p>
								</div>
							</div>
							<Button type="button" onClick={handleUpgrade}>
								Upgrade to Enterprise
							</Button>
						</div>

						<div className="my-5 h-px bg-border/60" />

						<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
							{planFeatures.map((feature) => (
								<div key={feature.label} className="flex items-center gap-2.5 text-sm">
									<span
										className={
											feature.included
												? "flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
												: "flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/50"
										}>
										<Check className="size-3" />
									</span>
									<span className={feature.included ? "text-foreground" : "text-muted-foreground line-through decoration-muted-foreground/40"}>{feature.label}</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				{/* Payment method */}
				<Card>
					<CardHeader>
						<CardTitle>Payment Method</CardTitle>
						<CardDescription>Your default payment method.</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
							<div className="flex size-10 items-center justify-center rounded-lg bg-foreground text-background">
								<CreditCard className="size-5" />
							</div>
							<div className="min-w-0">
								<p className="text-sm font-medium text-foreground">Visa ending in 4242</p>
								<p className="text-xs text-muted-foreground">Expires 08/28</p>
							</div>
						</div>
					</CardContent>
					<CardFooter>
						<Button type="button" variant="outline" className="w-full" onClick={handleUpgrade}>
							Update payment method
						</Button>
					</CardFooter>
				</Card>
			</div>

			{/* Invoices */}
			<Card>
				<CardHeader>
					<CardTitle>Invoices</CardTitle>
					<CardDescription>Your billing history for the last 5 months.</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Invoice</TableHead>
								<TableHead>Date</TableHead>
								<TableHead className="text-end">Amount</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="w-12" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{invoices.map((invoice) => (
								<TableRow key={invoice.id}>
									<TableCell className="font-medium">{invoice.id}</TableCell>
									<TableCell className="text-muted-foreground">{invoice.date}</TableCell>
									<TableCell className="text-end tabular-nums">{invoice.amount}</TableCell>
									<TableCell>
										<Badge variant={statusVariant[invoice.status]}>{invoice.status}</Badge>
									</TableCell>
									<TableCell className="text-end">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="size-8"
											data-invoice-id={invoice.id}
											onClick={handleDownloadInvoice}
											aria-label={`Download ${invoice.id}`}>
											<Download className="size-4" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
						<TableCaption>All amounts are in USD.</TableCaption>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
