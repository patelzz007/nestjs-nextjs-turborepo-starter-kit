import { ApiErrorResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";
import { describe, expect, it } from "vitest";

import { ApiErrorResponseDto, SWAGGER_METADATA_FACTORY } from "../api-response.dto";

describe("ApiErrorResponseDto", () => {
	it("gives Swagger the same property metadata nestjs-zod generates for the error envelope", () => {
		expect(ApiErrorResponseDto[SWAGGER_METADATA_FACTORY]()).toEqual(createZodDto(ApiErrorResponseSchema)[SWAGGER_METADATA_FACTORY]());
	});

	it("hands every reference its own copy, so Swagger editing one cannot change the next", () => {
		const first = ApiErrorResponseDto[SWAGGER_METADATA_FACTORY]();
		const second = ApiErrorResponseDto[SWAGGER_METADATA_FACTORY]();

		expect(second).toEqual(first);
		expect(second).not.toBe(first);
	});
});
