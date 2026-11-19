import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { handlerOf, type MetadataValue } from "../../e2e/support/route-metadata";

/**
 * The metadata key `@Cron()` of `@nestjs/schedule` writes its options under (not exported by the package). If a
 * release renames it, this spec finds no cron options and fails on the count below, never passes silently.
 */
const SCHEDULE_CRON_OPTIONS = "SCHEDULE_CRON_OPTIONS";
const CRON_DECORATOR = "@Cron(";

const reflector = new Reflector();

/** What `Reflector.get` reads metadata off: a class or one of its methods. */
type MetadataTarget = Parameters<Reflector["get"]>[1];
const MetadataTargetSchema = z.custom<MetadataTarget>((value) => z.function().safeParse(value).success);
const PrototypeSchema = z.custom<object>((value) => z.looseObject({}).safeParse(value).success);
const ModuleExportsSchema = z.custom<object>((value) => z.looseObject({}).safeParse(value).success);
const CronOptionsSchema = z.looseObject({ waitForCompletion: z.boolean().optional() });

interface CronMethod {
	readonly id: string;
	readonly waitsForCompletion: boolean;
}

function sourceFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((entry: string): string[] => {
		const path: string = join(directory, entry);
		if (statSync(path).isDirectory()) {
			return entry === "__tests__" ? [] : sourceFiles(path);
		}
		return path.endsWith(".ts") ? [path] : [];
	});
}

function cronMethodsOf(target: MetadataTarget): CronMethod[] {
	const prototype: object = PrototypeSchema.parse(Object.getOwnPropertyDescriptor(target, "prototype")?.value);
	return Object.getOwnPropertyNames(prototype)
		.filter((name: string): boolean => name !== "constructor")
		.flatMap((name: string): CronMethod[] => {
			const options = reflector.get<MetadataValue | undefined>(SCHEDULE_CRON_OPTIONS, handlerOf(prototype, name));
			if (options === undefined) {
				return [];
			}
			return [{ id: `${target.name}.${name}`, waitsForCompletion: CronOptionsSchema.parse(options).waitForCompletion === true }];
		});
}

const cronFiles: readonly string[] = sourceFiles(resolve(import.meta.dirname, "..")).filter((file: string): boolean => readFileSync(file, "utf8").includes(CRON_DECORATOR));
const declaredCrons: number = cronFiles.reduce((count: number, file: string): number => count + readFileSync(file, "utf8").split(CRON_DECORATOR).length - 1, 0);
const cronMethods: CronMethod[] = [];
for (const file of cronFiles) {
	const exported: object = ModuleExportsSchema.parse(await import(file));
	for (const value of Object.values(exported)) {
		const target = MetadataTargetSchema.safeParse(value);
		if (target.success) {
			cronMethods.push(...cronMethodsOf(target.data));
		}
	}
}

describe("ADR 095: a cron tick in progress finishes before shutdown closes its connections", () => {
	it("finds every @Cron() of the API", () => {
		expect(cronFiles.length).toBeGreaterThan(0);
		expect(cronMethods).toHaveLength(declaredCrons);
	});

	it("declares every @Cron() with waitForCompletion, so the scheduler waits for a running tick when it stops", () => {
		expect(cronMethods.filter((method: CronMethod): boolean => !method.waitsForCompletion).map((method: CronMethod): string => method.id)).toStrictEqual([]);
	});
});
