# CDN Service

Simple Express app for file uploads/downloads, backed by local disk storage in `uploads/`.

Admin endpoints (`GET /cdn/files`, `DELETE /cdn/delete/:id`) require `Authorization: Bearer <CDN_ADMIN_TOKEN>`, set via the `CDN_ADMIN_TOKEN` environment variable on the container.
