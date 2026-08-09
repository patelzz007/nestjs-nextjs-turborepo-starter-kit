"use client";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, type AccordionItemStatus, type AccordionRef } from "@workspace/ui/components/accordion";
import { PlusIcon, SearchIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Demo data shape — the *content* lives in the page (`app/(panel)/page.tsx`),
 * this smart component only owns interaction state (search query, open items,
 * drag order).
 */
export interface AccordionDemoItem {
	readonly id: string;
	readonly value: string;
	readonly title: string;
	readonly body: string;
	readonly status?: AccordionItemStatus;
	readonly count?: number;
	readonly shortcut?: string;
	readonly disabled?: boolean;
	readonly lazy?: boolean;
	readonly autofocus?: boolean;
	/** Nested sub-questions — rendered as an inner accordion inside the body (feature 14). */
	readonly children?: readonly AccordionDemoItem[];
}

export interface AccordionShowcaseProps {
	readonly faqItems: readonly AccordionDemoItem[];
	readonly statusItems: readonly AccordionDemoItem[];
	readonly reorderItems: readonly AccordionDemoItem[];
	readonly variantItems: readonly AccordionDemoItem[];
}

export function AccordionShowcase({ faqItems, statusItems, reorderItems, variantItems }: AccordionShowcaseProps): React.JSX.Element {
	const accordionRef = useRef<AccordionRef | null>(null);
	const [query, setQuery] = useState("");
	const [openValues, setOpenValues] = useState<string[]>(["faq-sessions"]);
	const [order, setOrder] = useState<readonly string[]>(reorderItems.map((item) => item.value));

	const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setQuery(event.target.value);
	}, []);

	const handleExpandAll = useCallback((): void => {
		accordionRef.current?.expandAll();
	}, []);

	const handleCollapseAll = useCallback((): void => {
		accordionRef.current?.collapseAll();
	}, []);

	const handleValueChange = useCallback((values: string[]): void => {
		setOpenValues([...values]);
	}, []);

	const orderedItems = useMemo(() => [...reorderItems].sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value)), [reorderItems, order]);
	const firstOrderedValue = order[0];

	return (
		<div className="grid gap-4 px-4 py-4 lg:grid-cols-2 lg:px-6">
			{/* ── 1. Single-open FAQ + search highlight + imperative API + hash linking ── */}
			<Card>
				<CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<CardTitle>Frequently asked questions</CardTitle>
						<CardDescription>Single-open · controlled · hashSync · highlight · imperative ref API</CardDescription>
					</div>
					<div className="flex gap-2">
						<Button size="sm" variant="outline" onClick={handleExpandAll}>
							Expand all
						</Button>
						<Button size="sm" variant="outline" onClick={handleCollapseAll}>
							Collapse all
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="relative">
						<SearchIcon className="inset-s-3 pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input className="ps-9" placeholder="Filter questions…" value={query} onChange={handleQueryChange} aria-label="Filter questions" />
					</div>
					<Accordion ref={accordionRef} value={openValues} onValueChange={handleValueChange} hashSync ariaLabel="Frequently asked questions">
						{faqItems.map((item) => (
							<AccordionItem key={item.value} id={item.id} value={item.value}>
								<AccordionTrigger highlight={query}>{item.title}</AccordionTrigger>
								<AccordionContent>
									{item.children !== undefined && item.children.length > 0 ? (
										<Accordion
											multiple
											variant="ghost"
											size="sm"
											defaultValue={item.children.slice(0, 1).map((child) => child.value)}
											ariaLabel={`${item.title} — sub-topics`}>
											{item.children.map((child) => (
												<AccordionItem key={child.value} value={child.value}>
													<AccordionTrigger>{child.title}</AccordionTrigger>
													<AccordionContent>{child.body}</AccordionContent>
												</AccordionItem>
											))}
										</Accordion>
									) : (
										item.body
									)}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</CardContent>
			</Card>

			{/* ── 2. Multi-open checklist + status / count / shortcut / disabled / lazy ── */}
			<Card>
				<CardHeader>
					<CardTitle>Deployment checklist</CardTitle>
					<CardDescription>Multiple-open · status · count · shortcut · disabled · lazy · autofocusContent</CardDescription>
				</CardHeader>
				<CardContent>
					<Accordion multiple defaultValue={["status-db"]}>
						{statusItems.map((item) => (
							<AccordionItem key={item.value} value={item.value} disabled={item.disabled} lazy={item.lazy}>
								<AccordionTrigger status={item.status} count={item.count} shortcut={item.shortcut}>
									{item.title}
								</AccordionTrigger>
								<AccordionContent>{item.body}</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</CardContent>
			</Card>

			{/* ── 3. Drag-to-reorder (bordered variant) ── */}
			<Card>
				<CardHeader>
					<CardTitle>Component order</CardTitle>
					<CardDescription>Bordered variant · reorderable — drag a row to reorder (native HTML5 DnD)</CardDescription>
				</CardHeader>
				<CardContent>
					<Accordion multiple variant="bordered" reorderable onReorder={setOrder} defaultValue={firstOrderedValue !== undefined ? [firstOrderedValue] : []}>
						{orderedItems.map((item, index) => (
							<AccordionItem key={item.value} value={item.value}>
								<AccordionTrigger count={index + 1}>{item.title}</AccordionTrigger>
								<AccordionContent>{item.body}</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
					<p className="mt-3 text-xs text-muted-foreground">Current order: {orderedItems.map((item) => item.title).join(" → ")}</p>
				</CardContent>
			</Card>

			{/* ── 4. Variants & sizes gallery ── */}
			<Card>
				<CardHeader>
					<CardTitle>Variants &amp; sizes</CardTitle>
					<CardDescription>
						sm + separated={false} · lg + custom icon · ghost · flush + animate={false} + persistKey
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-6 sm:grid-cols-2">
					<section className="space-y-2">
						<h3 className="text-sm font-medium">default / sm / no separators</h3>
						<Accordion multiple variant="default" size="sm" separated={false} defaultValue={["v-one"]}>
							{variantItems.slice(0, 3).map((item) => (
								<AccordionItem key={item.value} value={item.value}>
									<AccordionTrigger>{item.title}</AccordionTrigger>
									<AccordionContent>{item.body}</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</section>

					<section className="space-y-2">
						<h3 className="text-sm font-medium">bordered / lg / custom icon</h3>
						<Accordion multiple variant="bordered" size="lg" defaultValue={["v-four"]}>
							{variantItems.slice(3).map((item) => (
								<AccordionItem key={item.value} value={item.value}>
									<AccordionTrigger icon={<PlusIcon className="size-4" />}>{item.title}</AccordionTrigger>
									<AccordionContent>{item.body}</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</section>

					<section className="space-y-2">
						<h3 className="text-sm font-medium">ghost / default</h3>
						<Accordion multiple variant="ghost" defaultValue={["v-two"]}>
							{variantItems.slice(0, 2).map((item) => (
								<AccordionItem key={item.value} value={item.value}>
									<AccordionTrigger>{item.title}</AccordionTrigger>
									<AccordionContent>{item.body}</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</section>

					<section className="space-y-2">
						<h3 className="text-sm font-medium">flush / animate off / persisted</h3>
						<Accordion multiple variant="flush" animate={false} persistKey="accordion-demo-variant" defaultValue={["v-three"]}>
							{variantItems.slice(1, 3).map((item) => (
								<AccordionItem key={item.value} value={item.value}>
									<AccordionTrigger>{item.title}</AccordionTrigger>
									<AccordionContent>{item.body}</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</section>
				</CardContent>
			</Card>
		</div>
	);
}
