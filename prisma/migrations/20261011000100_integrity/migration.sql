ALTER TABLE "User" ADD CONSTRAINT "User_single_owner" CHECK ("singletonKey" = 1);

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_time_range" CHECK ("endTime" IS NULL OR ("startTime" IS NOT NULL AND "endTime" > "startTime")),
  ADD CONSTRAINT "Event_completion_state" CHECK (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL));

ALTER TABLE "WeekTemplateItem"
  ADD CONSTRAINT "WeekTemplateItem_weekday" CHECK ("weekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "WeekTemplateItem_time_range" CHECK ("endTime" IS NULL OR ("startTime" IS NOT NULL AND "endTime" > "startTime"));

ALTER TABLE "WeekTemplateApplication"
  ADD CONSTRAINT "WeekTemplateApplication_monday" CHECK (EXTRACT(ISODOW FROM "weekStart") = 1);

ALTER TABLE "RecurringEvent"
  ADD CONSTRAINT "RecurringEvent_interval" CHECK ("interval" > 0),
  ADD CONSTRAINT "RecurringEvent_count" CHECK ("count" IS NULL OR "count" > 0),
  ADD CONSTRAINT "RecurringEvent_termination" CHECK ("until" IS NULL OR ("count" IS NULL AND "until" >= "startDate")),
  ADD CONSTRAINT "RecurringEvent_time_range" CHECK ("endTime" IS NULL OR ("startTime" IS NOT NULL AND "endTime" > "startTime"));

ALTER TABLE "RecurringOccurrence"
  ADD CONSTRAINT "RecurringOccurrence_completion_state" CHECK (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL)),
  ADD CONSTRAINT "RecurringOccurrence_time_range" CHECK ("endTimeOverride" IS NULL OR ("startTimeOverride" IS NOT NULL AND "endTimeOverride" > "startTimeOverride")),
  ADD CONSTRAINT "RecurringOccurrence_time_inheritance" CHECK ("hasTimeOverride" OR ("startTimeOverride" IS NULL AND "endTimeOverride" IS NULL));
