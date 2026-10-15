import "reflect-metadata";
import { Controller, Sse, type MessageEvent } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { EMPTY, type Observable } from "rxjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiEventStreamResponse, EVENT_STREAM_MEDIA_TYPE } from "./api-event-stream.decorator";

class StreamController {
	public events(): Observable<MessageEvent> {
		return EMPTY;
	}
}

// The unit runner has no decorator transform: apply them as the compiler would.
const descriptor = Object.getOwnPropertyDescriptor(StreamController.prototype, "events");
if (descriptor === undefined) {
	throw new Error("StreamController.events is not a method");
}
ApiEventStreamResponse("One frame per change")(StreamController.prototype, "events", descriptor);
Sse("events")(StreamController.prototype, "events", descriptor);
Controller("stream")(StreamController);

/** The one operation's 200 response, as the OpenAPI export writes it. */
const OkResponseSchema = z.object({ description: z.string(), content: z.record(z.string(), z.object({}).loose()) });

describe("ApiEventStreamResponse", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ controllers: [StreamController] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("exports text/event-stream as the stream's media type, so the reference never defaults it to JSON", () => {
		const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
		const ok = OkResponseSchema.parse(document.paths["/stream/events"]?.get?.responses["200"]);

		expect(Object.keys(ok.content)).toEqual([EVENT_STREAM_MEDIA_TYPE]);
		expect(ok.description).toBe("One frame per change");
	});
});
