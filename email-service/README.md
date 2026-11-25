# Hub email relay

Private SMTP relay. Hub's `emailQueue` worker posts to `POST /send` with `X-API-Key`; this service owns the `SMTP_*` settings. It is not published on any host port and is reachable only on Hub's private Compose network.

Source is the code running on the VPS today (VPS checkout `664e2b7`, five files matched the running container byte for byte). It is imported unchanged so the cutover does not change mail behaviour. `Dockerfile` still uses the floating `oven/bun:1` base; pin it by digest in a follow-up.

## Runtime settings (environment only, never committed)

`SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `EMAIL_SERVICE_API_KEY`, `PORT` (default 2525). The process exits at startup if SMTP verification fails.

## Known limits

- **No duplicate protection.** If the SMTP server accepts a message but the acknowledgement is lost, `/send` returns HTTP 500 and a repeat request delivers a second copy.
- **No SMTP timeouts** are set on the transporter.
- Keep job retries off (the `emailQueue` sets no `attempts`, so BullMQ makes one attempt) and reconcile ambiguous failures by hand before replay, until duplicate protection exists. Exactly one email worker may own sends.

## Publishing

`.github/workflows/email-service-image.yml` builds this directory and publishes `ghcr.io/gen7fuel/thehub-email-service` for linux/amd64. Pin the printed `@sha256:` digest in the release manifest. Wiring the image into `compose.yaml`/`compose.vm.yaml` and the release manifest is a separate change because it alters the deployed release contract.
