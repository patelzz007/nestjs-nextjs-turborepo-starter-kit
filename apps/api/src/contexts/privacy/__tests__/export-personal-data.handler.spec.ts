import { Readable } from "node:stream";

import { epochMs, PersonalDataManifestSchema, type JsonValue, type PersonalDataManifest } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ActorContextSchema, type ActorContext } from "../../../platform/application/actor-context";
import type { Clock } from "../../../platform/application/clock.port";
import { PersonalDataExportRegistry } from "../../../platform/application/personal-data/personal-data-export.registry";
import { rowsToJson } from "../../../platform/infrastructure/personal-data/read-as-person";
import type { PersonalDataArchiveFile, PersonalDataArchivePort, PersonalDataExportAuditPort } from "../application/ports/personal-data-export.ports";
import { ExportPersonalDataHandler } from "../application/queries/export-personal-data/export-personal-data.handler";
import { ExportPersonalDataQuery } from "../application/queries/export-personal-data/export-personal-data.query";
import { ZipPersonalDataArchiveAdapter } from "../infrastructure/adapters/zip-personal-data-archive.adapter";
import { captureFastifyRequest } from "../../../../test/support/fastify-request";

const NOW = Date.UTC(2026, 10, 3, 9, 30);
const REQUEST_META = { requestId: "corr-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

function person(impersonatorUserId: string | null = null): ActorContext {
	return ActorContextSchema.parse({
		kind: "user",
		userId: "user-1",
		sessionId: "s-1",
		tenantId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId,
		request: REQUEST_META,
	});
}

/** Records the audit call and what was archived, in order. */
class Recorder implements PersonalDataExportAuditPort, PersonalDataArchivePort {
	public readonly steps: string[] = [];
	public summary: JsonValue = null;
	public manifest: PersonalDataManifest | null = null;
	public files: readonly PersonalDataArchiveFile[] = [];

	public recordExport(_request: FastifyRequest, summary: JsonValue): Promise<void> {
		this.steps.push("audit");
		this.summary = summary;
		return Promise.resolve();
	}

	public archive(manifest: PersonalDataManifest, files: readonly PersonalDataArchiveFile[]): Readable {
		this.steps.push("archive");
		this.manifest = manifest;
		this.files = files;
		return Readable.from([]);
	}
}

function handler(recorder: Recorder, failAudit = false): ExportPersonalDataHandler {
	const registry = new PersonalDataExportRegistry();
	registry.register({ section: "claims", description: "Claims", export: () => Promise.resolve({ records: 2, data: [{ id: "c1" }, { id: "c2" }] }) });
	registry.register({ section: "account", description: "Account", export: ({ userId }) => Promise.resolve({ records: 1, data: { userId } }) });
	const audit: PersonalDataExportAuditPort = failAudit ? { recordExport: () => Promise.reject(new Error("audit store down")) } : recorder;
	const clock: Clock = { now: () => epochMs(NOW) };
	return new ExportPersonalDataHandler(registry, recorder, audit, clock);
}

describe("ExportPersonalDataHandler", () => {
	it("assembles every section for the person, audits the summary first, then builds the archive", async () => {
		const recorder = new Recorder();
		const result = await handler(recorder).execute(new ExportPersonalDataQuery(person(), await captureFastifyRequest({ headers: {} })));

		expect(recorder.steps).toStrictEqual(["audit", "archive"]);
		expect(recorder.summary).toStrictEqual({
			export: "personal-data",
			sections: [
				{ name: "account", records: 1 },
				{ name: "claims", records: 2 },
			],
		});
		expect(PersonalDataManifestSchema.parse(recorder.manifest)).toMatchObject({ formatVersion: 1, userId: "user-1", generatedAt: NOW });
		expect(recorder.files.map((file) => file.file)).toStrictEqual(["account.json", "claims.json"]);
		expect(recorder.files.map((file) => file.data)).toStrictEqual([{ userId: "user-1" }, [{ id: "c1" }, { id: "c2" }]]);
		expect(result).toMatchObject({ fileName: "personal-data-2026-11-03.zip", contentType: "application/zip" });
	});

	it("refuses a session impersonating the person, and anyone who isn't a signed-in person", async () => {
		const recorder = new Recorder();
		await expect(handler(recorder).execute(new ExportPersonalDataQuery(person("support-1"), await captureFastifyRequest({ headers: {} })))).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		const anonymous = ActorContextSchema.parse({ kind: "anonymous", tenantId: null, request: REQUEST_META });
		await expect(handler(recorder).execute(new ExportPersonalDataQuery(anonymous, await captureFastifyRequest({ headers: {} })))).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(recorder.steps).toStrictEqual([]);
	});

	it("releases nothing when the audit row can't be written", async () => {
		const recorder = new Recorder();
		await expect(handler(recorder, true).execute(new ExportPersonalDataQuery(person(), await captureFastifyRequest({ headers: {} })))).rejects.toThrow("audit store down");
		expect(recorder.steps).toStrictEqual([]);
	});
});

describe("ZipPersonalDataArchiveAdapter", () => {
	it("writes manifest.json then each section, as readable JSON", async () => {
		const manifest: PersonalDataManifest = {
			formatVersion: 1,
			generatedAt: epochMs(NOW),
			userId: "user-1",
			sections: [{ name: "account", file: "account.json", description: "Account", records: 1 }],
		};
		const chunks: Buffer[] = [];
		for await (const chunk of new ZipPersonalDataArchiveAdapter().archive(manifest, [{ file: "account.json", data: { email: "alice@example.com" } }])) {
			chunks.push(z.instanceof(Buffer).parse(chunk));
		}
		const files = unzipSync(new Uint8Array(Buffer.concat(chunks)));
		expect(Object.keys(files)).toStrictEqual(["manifest.json", "account.json"]);
		expect(PersonalDataManifestSchema.parse(JSON.parse(Buffer.from(files["manifest.json"] ?? new Uint8Array()).toString("utf8")))).toStrictEqual(manifest);
		expect(JSON.parse(Buffer.from(files["account.json"] ?? new Uint8Array()).toString("utf8"))).toStrictEqual({ email: "alice@example.com" });
	});
});

describe("rowsToJson", () => {
	it("turns BigInt columns into numbers and keeps the rest", () => {
		expect(rowsToJson([{ id: "a", at: 1_793_664_000_000n, note: null, meta: { ok: true } }])).toStrictEqual([
			{ id: "a", at: 1_793_664_000_000, note: null, meta: { ok: true } },
		]);
	});
});
