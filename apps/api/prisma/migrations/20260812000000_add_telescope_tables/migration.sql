-- CreateTable
CREATE TABLE "telescope_requests" (
    "id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "user_id" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "query_string" TEXT,
    "ip" VARCHAR(64),
    "user_agent" TEXT,
    "request_body" JSONB,
    "response_body" JSONB,
    "request_headers" JSONB,
    "spans" JSONB NOT NULL,
    "logs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telescope_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_queries" (
    "id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "operation" VARCHAR(20) NOT NULL,
    "query" TEXT NOT NULL,
    "params" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telescope_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_exceptions" (
    "id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "error_group" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "status_code" INTEGER,
    "path" TEXT,
    "method" VARCHAR(10),
    "user_id" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telescope_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_dumps" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telescope_dumps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telescope_requests_created_at_idx" ON "telescope_requests"("created_at");

-- CreateIndex
CREATE INDEX "telescope_requests_correlation_id_idx" ON "telescope_requests"("correlation_id");

-- CreateIndex
CREATE INDEX "telescope_queries_created_at_idx" ON "telescope_queries"("created_at");

-- CreateIndex
CREATE INDEX "telescope_queries_correlation_id_idx" ON "telescope_queries"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "telescope_exceptions_error_group_key" ON "telescope_exceptions"("error_group");

-- CreateIndex
CREATE INDEX "telescope_exceptions_created_at_idx" ON "telescope_exceptions"("created_at");

-- CreateIndex
CREATE INDEX "telescope_dumps_created_at_idx" ON "telescope_dumps"("created_at");
