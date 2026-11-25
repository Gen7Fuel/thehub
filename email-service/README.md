# Hub email relay

Private SMTP relay. Hub's `emailQueue` worker posts to `POST /send` with `X-API-Key`; this service owns the `SMTP_*` settings. It is not published on any host port and is reachable only on Hub's private Compose network.

The base source is the code that ran on the VPS (checkout `664e2b7`). On top of it the relay now bounds every SMTP stage with timeouts and protects against duplicate delivery.

## Runtime settings (environment only, never committed)

| Variable | Purpose |
|---|---|
| `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP provider. The process exits at startup if SMTP verification fails. |
| `EMAIL_SERVICE_API_KEY` | Shared secret for `X-API-Key`. |
| `PORT` (2525) | Listen port. |
| `IDEMPOTENCY_DIR` (`/var/lib/email-relay`) | Journal directory. Mount a volume here. The process exits if it cannot be created. |
| `REQUIRE_IDEMPOTENCY_KEY` (`false`) | Set `true` to reject `/send` without an `Idempotency-Key`. |
| `SMTP_SOCKET_TIMEOUT_MS` (60000) | Idle socket timeout (large attachments). DNS, connection and greeting timeouts are fixed at 10 s. |

## Duplicate protection

Send `Idempotency-Key: <1-128 chars of A-Z a-z 0-9 . _ : ->` with `/send` (Hub should use the BullMQ job id, for example `emailQueue:<id>`). Without the header the relay behaves as before and gives no protection.

| Situation | Response |
|---|---|
| First request with the key | Sends. `200 {ok, messageId}` |
| Repeat after success | `200 {ok, messageId, duplicate: true}`, nothing is sent |
| SMTP server unreachable at the pre-send check | `503 smtp_unavailable`, no state recorded, safe to retry |
| Server explicitly refuses (`EAUTH`, `EENVELOPE`, `EMESSAGE` with an SMTP reply code) | `500`, key released, safe to retry |
| Any other failure, or a crash, after the message was handed to SMTP | `502 ambiguous_delivery`, key blocked |
| Repeat while blocked | `409 ambiguous_delivery` |
| Repeat while the first request is still sending | `409 in_flight` |
| Same key, different message | `422 key_reuse` |

Why ambiguous outcomes block: a server that accepts a message and then drops the connection before acknowledging surfaces in nodemailer as a plain `ECONNECTION`, indistinguishable from a refused connection. Only an explicit server refusal proves nothing was delivered.

State is an fsynced, append-only journal (`journal.jsonl`) written before the relay talks to SMTP, so a crash mid-send leaves the key blocked, not forgotten. It holds keys, a hash of the message, state and message id, never message content. Entries expire after 7 days. If the journal cannot be written, `/send` returns `503` and sends nothing.

### Reconciling a blocked key (operator)

Check the provider's sent log or the recipient, then:

```sh
# state of one key (no message content)
curl -H "X-API-Key: $KEY" http://email-service:2525/send/emailQueue:42
# delivered: leave it blocked; repeats are refused until the entry expires.
# not delivered: clear it, then replay the job (same key)
curl -X DELETE -H "X-API-Key: $KEY" http://email-service:2525/send/emailQueue:42
```

Only a blocked (`uncertain`) key can be cleared.

## Operating rules

- Exactly one email worker owns sends. Keep BullMQ job retries off (`emailQueue` sets no `attempts`).
- Hub's worker must send the header before `REQUIRE_IDEMPOTENCY_KEY` is switched on. Until then, only keyed callers are protected.
- A restart keeps the journal; replacing the container keeps it only if `IDEMPOTENCY_DIR` is on a volume.
- `Dockerfile` still uses the floating `oven/bun:1` base; pin it by digest in a follow-up.

## Tests and publishing

`bun test` (18 tests, no network) covers the classification, the store (restart, torn line, expiry) and the HTTP behavior, including an end-to-end case with real nodemailer against a fake SMTP server that accepts a message and then drops the connection. CI runs them on pull requests.

`.github/workflows/email-service-image.yml` runs the tests, then on `main` builds and publishes `ghcr.io/gen7fuel/thehub-email-service` for linux/amd64 and prints the `@sha256:` digest. Pin that digest in `compose.vm.yaml` (with a volume at `/var/lib/email-relay`) in a separate change, because it alters the reviewed configuration hash.
