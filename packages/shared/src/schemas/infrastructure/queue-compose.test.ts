import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ALL_QUEUE_NAMES } from "./queue";

// compose.yml's Bull Board service lists the queues it shows (QUEUE_NAMES). YAML
// cannot import the registry, so this keeps the two in step: a queue added to
// QueueNameSchema without being added to Bull Board (or the reverse) fails here.
const COMPOSE_FILE: string = path.resolve(import.meta.dirname, "../../../../../compose.yml");
const BULL_BOARD_QUEUE_NAMES_PATTERN = /^\s+QUEUE_NAMES:\s*(\S+)\s*$/m;

describe("compose.yml Bull Board queue list", () => {
	it("lists exactly the queues of the shared registry", () => {
		const match = BULL_BOARD_QUEUE_NAMES_PATTERN.exec(readFileSync(COMPOSE_FILE, "utf8"));

		expect(match?.[1], "compose.yml has no QUEUE_NAMES line for Bull Board").toBeDefined();
		expect(String(match?.[1]).split(",").sort()).toEqual([...ALL_QUEUE_NAMES].sort());
	});
});
