-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."business_ideas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."evaluations" (
    "id" TEXT NOT NULL,
    "business_idea_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "results" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_results" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input_data" JSONB,
    "output_data" JSONB,
    "score" DOUBLE PRECISION,
    "insights" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "public"."users"("created_at");

-- CreateIndex
CREATE INDEX "business_ideas_user_id_idx" ON "public"."business_ideas"("user_id");

-- CreateIndex
CREATE INDEX "business_ideas_status_idx" ON "public"."business_ideas"("status");

-- CreateIndex
CREATE INDEX "business_ideas_created_at_idx" ON "public"."business_ideas"("created_at");

-- CreateIndex
CREATE INDEX "evaluations_business_idea_id_idx" ON "public"."evaluations"("business_idea_id");

-- CreateIndex
CREATE INDEX "evaluations_status_idx" ON "public"."evaluations"("status");

-- CreateIndex
CREATE INDEX "evaluations_priority_idx" ON "public"."evaluations"("priority");

-- CreateIndex
CREATE INDEX "evaluations_created_at_idx" ON "public"."evaluations"("created_at");

-- CreateIndex
CREATE INDEX "agent_results_evaluation_id_idx" ON "public"."agent_results"("evaluation_id");

-- CreateIndex
CREATE INDEX "agent_results_agent_type_idx" ON "public"."agent_results"("agent_type");

-- CreateIndex
CREATE INDEX "agent_results_status_idx" ON "public"."agent_results"("status");

-- CreateIndex
CREATE INDEX "agent_results_created_at_idx" ON "public"."agent_results"("created_at");

-- AddForeignKey
ALTER TABLE "public"."business_ideas" ADD CONSTRAINT "business_ideas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evaluations" ADD CONSTRAINT "evaluations_business_idea_id_fkey" FOREIGN KEY ("business_idea_id") REFERENCES "public"."business_ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_results" ADD CONSTRAINT "agent_results_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
