import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailLogEventsService } from "./email-log-events.service";

describe("EmailLogEventsService", () => {
	let service: EmailLogEventsService;

	beforeEach(() => {
		service = new EmailLogEventsService();
	});

	it("delivers a signal to a subscriber on emit", () => {
		const handler = vi.fn();
		const subscription = service.observeUpdates().subscribe(handler);
		service.emitUpdated();
		expect(handler).toHaveBeenCalledTimes(1);
		subscription.unsubscribe();
	});

	it("broadcasts to every subscriber", () => {
		const first = vi.fn();
		const second = vi.fn();
		const subA = service.observeUpdates().subscribe(first);
		const subB = service.observeUpdates().subscribe(second);
		service.emitUpdated();
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		subA.unsubscribe();
		subB.unsubscribe();
	});

	it("stops delivering to a subscriber after it unsubscribes", () => {
		const handler = vi.fn();
		const subscription = service.observeUpdates().subscribe(handler);
		subscription.unsubscribe();
		service.emitUpdated();
		expect(handler).not.toHaveBeenCalled();
	});

	it("only notifies subscribers that joined after an emit (no replay)", () => {
		service.emitUpdated(); // nobody listening yet
		const handler = vi.fn();
		const subscription = service.observeUpdates().subscribe(handler);
		expect(handler).not.toHaveBeenCalled();
		service.emitUpdated();
		expect(handler).toHaveBeenCalledTimes(1);
		subscription.unsubscribe();
	});
});
