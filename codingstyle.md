# Coding Style

## Typescript

- No semicolons
- 4 size tab indentation

## examples

### No unnessary line breaks

These line breaks are not necessary and should be removed.

**Bad**

30 +        "/api/external-integrations":
31 +            routes.externalIntegrationsCollectionRoute(database),
32 +        "/api/external-integrations/clockify":
33 +            routes.clockifyIntegrationRoute(database),
34 +        "/api/external-integrations/:id/clockify-options":
35 +            routes.clockifyIntegrationOptionsRoute(database),
36 +        "/api/external-integrations/:id":
37 +            routes.externalIntegrationDetailRoute(database),
38 +        "/api/import-schedules": routes.importSchedulesCollectionRoute(database),
39 +        "/api/import-schedules/:id/run":
40 +            routes.importScheduleRunRoute(database),
41 +        "/api/import-schedules/:id": routes.importScheduleDetailRoute(database),
42 +        "/api/jobs": routes.jobsCollectionRoute(database),
43 +        "/api/jobs/:id": routes.jobDetailRoute(database),

**Better**

30 +        "/api/external-integrations": routes.externalIntegrationsCollectionRoute(database),
31 +        "/api/external-integrations/clockify": routes.clockifyIntegrationRoute(database),
32 +        "/api/external-integrations/:id/clockify-options": routes.clockifyIntegrationOptionsRoute(database),
33 +        "/api/external-integrations/:id": routes.externalIntegrationDetailRoute(database),
34 +        "/api/import-schedules": routes.importSchedulesCollectionRoute(database),
35 +        "/api/import-schedules/:id/run": routes.importScheduleRunRoute(database),
36 +        "/api/import-schedules/:id": routes.importScheduleDetailRoute(database),
37 +        "/api/jobs": routes.jobsCollectionRoute(database),
38 +        "/api/jobs/:id": routes.jobDetailRoute(database),
