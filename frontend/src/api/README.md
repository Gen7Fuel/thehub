# Frontend API architecture

The API layer has two responsibilities that must remain separate.

## Resource APIs (`*.api.ts`)

Resource APIs mirror backend route domains such as `locations`, `users`,
`roles`, `permissions`, `safesheets`, `ar-customers`, `academy`, `atm`,
`accounting-reports`, `ai-customer`, `audit`, `bulletin`, `vendors`, `auth`, and
`maintenance`.

They own:

- endpoint paths and HTTP methods;
- request and response payload shapes;
- shared authentication/error behavior through `apiClient`;
- conversion of `RequestOptions` into headers through `requestConfig`.

An endpoint should be defined in exactly one resource API.

## Feature services (`*.service.ts`)

Feature services describe why a screen is calling one or more resources. They
may compose multiple resource APIs, but must not contain endpoint paths or call
Axios directly.

They own:

- required permission;
- action type and resource label;
- feature source such as `settings.users`;
- human-readable action messages;
- orchestration spanning multiple backend resources.

Pages and query definitions consume feature services. They should not call
`apiClient`, Axios, or resource APIs directly.

```text
route/component -> feature service -> resource API -> apiClient
```
