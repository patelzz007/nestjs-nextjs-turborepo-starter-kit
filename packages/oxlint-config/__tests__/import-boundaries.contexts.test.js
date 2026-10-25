import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DDD_CONTEXTS, apiArchitectureBoundaryConfigs } from "../import-boundaries.js";
import { isolatedConfig, ruleMessagesFor } from "../testing.js";

const API_CONTEXTS_DIRECTORY = fileURLToPath(new URL("../../../apps/api/src/contexts/", import.meta.url));

const API_BOUNDARIES_ONLY = isolatedConfig({ overrides: apiArchitectureBoundaryConfigs });

/** The import-boundary messages for `code` as `filePath` (relative to apps/api) with ONLY the API architecture blocks. */
function boundaryMessages(code, filePath) {
	return ruleMessagesFor(API_BOUNDARIES_ONLY, code, filePath, "workspace/restricted-imports");
}

describe("API architecture import boundaries (§12.1)", () => {
	it("rejects a framework import in a context domain and allows a pure module", () => {
		const file = "src/contexts/rewards/domain/reward.ts";
		expect(boundaryMessages('import { Injectable } from "@nestjs/common";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { RewardId } from "./reward-id";', file)).toEqual([]);
	});

	it("rejects Prisma in application code and allows Nest common and cqrs", () => {
		const file = "src/contexts/rewards/application/submit.handler.ts";
		expect(boundaryMessages('import { Prisma } from "@prisma/client";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { Injectable } from "@nestjs/common";\nimport { Command } from "@nestjs/cqrs";', file)).toEqual([]);
	});

	it("rejects persistence from presentation and allows a command dispatch", () => {
		const file = "src/contexts/rewards/presentation/http/rewards.controller.ts";
		expect(boundaryMessages('import { PrismaClient } from "@prisma/client";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { CommandBus } from "@nestjs/cqrs";', file)).toEqual([]);
	});

	it("rejects CommandBus from a job and allows SystemCommandDispatcher", () => {
		const file = "src/contexts/rewards/presentation/jobs/auto-publish.job.ts";
		expect(boundaryMessages('import { CommandBus } from "@nestjs/cqrs";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";', file)).toEqual([]);
	});

	it("rejects another context's internals and allows its public-api", () => {
		const file = "src/contexts/rewards/application/checkout.handler.ts";
		expect(boundaryMessages('import { Tenant } from "../../tenancy/domain/tenant";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { TenantReadPort } from "../../tenancy/public-api";', file)).toEqual([]);
	});

	it("applies the layer rules to the tenancy context", () => {
		const file = "src/contexts/tenancy/domain/tenant.ts";
		expect(boundaryMessages('import { Injectable } from "@nestjs/common";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { Reward } from "../../rewards/domain/reward";', "src/contexts/tenancy/application/x.handler.ts").length).toBeGreaterThan(0);
	});

	it("names every context folder of the API, so no context escapes the rules", () => {
		const folders = readdirSync(API_CONTEXTS_DIRECTORY, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name !== "__tests__")
			.map((entry) => entry.name);
		expect([...DDD_CONTEXTS].sort()).toEqual(folders.sort());
	});

	it("rejects PrismaBaseRepository outside infrastructure and allows it there", () => {
		const application = "src/contexts/catalog/application/product.service.ts";
		const infrastructure = "src/contexts/catalog/infrastructure/product.repository.ts";
		const specifier = 'import { PrismaBaseRepository } from "../../../platform/infrastructure/persistence/prisma-base.repository";';
		expect(boundaryMessages(specifier, application).length).toBeGreaterThan(0);
		expect(boundaryMessages(specifier, infrastructure)).toEqual([]);
	});

	it("rejects Nest from platform domain", () => {
		const file = "src/platform/domain/reward.ts";
		expect(boundaryMessages('import { Injectable } from "@nestjs/common";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { DomainEvent } from "./domain-event";', file)).toEqual([]);
	});

	it("rejects a context import from platform application and allows a port", () => {
		const file = "src/platform/application/clock.port.ts";
		expect(boundaryMessages('import { Reward } from "../../contexts/rewards/public-api";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import type { EpochMs } from "@workspace/shared";', file)).toEqual([]);
	});

	it("rejects a file left under modules/", () => {
		const messages = ruleMessagesFor(API_BOUNDARIES_ONLY, "export const probe = 1;\n", "src/modules/legacy.ts", "workspace/restricted-syntax");
		expect(messages).toContain("modules/ was retired by the DDD migration; use contexts/.");
		expect(boundaryMessages("export const probe = 1;\n", "src/contexts/identity/auth/probe.ts")).toEqual([]);
	});

	it("rejects a context's internals from platform presentation and allows its public-api", () => {
		const file = "src/platform/presentation/http/errors/status-map.ts";
		expect(boundaryMessages('import { Reward } from "../../../../contexts/rewards/domain/reward";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { RewardErrorCode } from "../../../../contexts/rewards/public-api";', file)).toEqual([]);
	});
});
