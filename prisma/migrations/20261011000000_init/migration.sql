-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EVENT', 'TASK');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "singletonKey" INTEGER NOT NULL DEFAULT 1,
    "passwordHash" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ActivityType" NOT NULL DEFAULT 'TASK',
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "startTime" TIME(0),
    "endTime" TIME(0),
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMPTZ(3),
    "templateApplicationId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekTemplate" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WeekTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekTemplateItem" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "type" "ActivityType" NOT NULL DEFAULT 'TASK',
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "startTime" TIME(0),
    "endTime" TIME(0),

    CONSTRAINT "WeekTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekTemplateApplication" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "appliedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekTemplateApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "seriesId" UUID NOT NULL,
    "previousId" UUID,
    "type" "ActivityType" NOT NULL DEFAULT 'TASK',
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "startTime" TIME(0),
    "endTime" TIME(0),
    "frequency" "Frequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "until" DATE,
    "count" INTEGER,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecurringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringOccurrence" (
    "id" UUID NOT NULL,
    "recurringEventId" UUID NOT NULL,
    "occurrenceDate" DATE NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMPTZ(3),
    "typeOverride" "ActivityType",
    "titleOverride" VARCHAR(200),
    "descriptionOverride" TEXT,
    "hasTimeOverride" BOOLEAN NOT NULL DEFAULT false,
    "startTimeOverride" TIME(0),
    "endTimeOverride" TIME(0),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecurringOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_singletonKey_key" ON "User"("singletonKey");

-- CreateIndex
CREATE INDEX "Event_userId_date_idx" ON "Event"("userId", "date");

-- CreateIndex
CREATE INDEX "Event_templateApplicationId_idx" ON "Event"("templateApplicationId");

-- CreateIndex
CREATE INDEX "WeekTemplate_userId_archivedAt_idx" ON "WeekTemplate"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "WeekTemplateItem_templateId_idx" ON "WeekTemplateItem"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekTemplateApplication_templateId_weekStart_key" ON "WeekTemplateApplication"("templateId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringEvent_previousId_key" ON "RecurringEvent"("previousId");

-- CreateIndex
CREATE INDEX "RecurringEvent_userId_effectiveFrom_idx" ON "RecurringEvent"("userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "RecurringEvent_seriesId_idx" ON "RecurringEvent"("seriesId");

-- CreateIndex
CREATE INDEX "RecurringOccurrence_scheduledDate_idx" ON "RecurringOccurrence"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOccurrence_recurringEventId_occurrenceDate_key" ON "RecurringOccurrence"("recurringEventId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_templateApplicationId_fkey" FOREIGN KEY ("templateApplicationId") REFERENCES "WeekTemplateApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekTemplate" ADD CONSTRAINT "WeekTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekTemplateItem" ADD CONSTRAINT "WeekTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WeekTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekTemplateApplication" ADD CONSTRAINT "WeekTemplateApplication_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WeekTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEvent" ADD CONSTRAINT "RecurringEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEvent" ADD CONSTRAINT "RecurringEvent_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "RecurringEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOccurrence" ADD CONSTRAINT "RecurringOccurrence_recurringEventId_fkey" FOREIGN KEY ("recurringEventId") REFERENCES "RecurringEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
