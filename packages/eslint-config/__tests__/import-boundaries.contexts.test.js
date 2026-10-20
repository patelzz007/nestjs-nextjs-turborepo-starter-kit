import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { apiArchitectureBoundaryConfigs } from "../import-boundaries.js";

function boundaryMessages(code, filePath) {
	const linter = new Linter({ configType: "flat" });
	return linter
		.verify(code, [{ files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } }, ...apiArchitectureBoundaryConfigs], filePath)
		.filter((message) => message.ruleId === "no-restricted-imports")
		.map((message) => message.message);
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
		expect(boundaryMessages('import { Org } from "../../tenants/domain/tenant";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { TenantReadPort } from "../../tenants/public-api";', file)).toEqual([]);
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
		const linter = new Linter({ configType: "flat" });
		const messages = linter
			.verify("export const probe = 1;\n", [{ files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } }, ...apiArchitectureBoundaryConfigs], "src/modules/legacy.ts")
			.filter((message) => message.ruleId === "no-restricted-syntax")
			.map((message) => message.message);
		expect(messages).toContain("modules/ was retired by the DDD migration; use contexts/.");
		expect(boundaryMessages("export const probe = 1;\n", "src/contexts/identity/auth/probe.ts")).toEqual([]);
	});

	it("rejects a context's internals from platform presentation and allows its public-api", () => {
		const file = "src/platform/presentation/http/errors/status-map.ts";
		expect(boundaryMessages('import { Reward } from "../../../../contexts/rewards/domain/reward";', file).length).toBeGreaterThan(0);
		expect(boundaryMessages('import { RewardErrorCode } from "../../../../contexts/rewards/public-api";', file)).toEqual([]);
	});
});
