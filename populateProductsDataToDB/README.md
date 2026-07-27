# populateProductsDataToDB

Downstream consumer in the [Shopify webhook pipeline](../README.md). Triggered by the SQS queue that [`enqueueWebhookDataToSQS`](../enqueueWebhookDataToSQS) publishes to; matches Shopify product webhook data against tenant tags and upserts product/variant records into Postgres.

## What it does

1. Iterates the SQS `Records` in the Lambda event.
2. Parses the (possibly double-encoded) `body`/`headers` out of each record.
3. Destructures product fields (`id`, `title`, `vendor`, `tags`, `variants`, etc.) from the payload.
4. Looks up tenant tags for the shop domain via `GET_TENANT_PRODUCT_TAGS_WITH_TENANT_ID`.
5. Compares the product's tags against the tenant's primary/secondary tags:
   - **No match** — skips the record.
   - **Primary match** — upserts the product via `POPULATE_PRODUCT_DATA_FROM_WEBHOOK`, then each variant via `POPULATE_PRODUCT_VARIANT_DATA`.
   - **Secondary-only match** — stages the raw payload in `product_temp_table` for later reconciliation instead of writing directly to the product tables.

## Environment variables

| Variable | Used for |
|---|---|
| `DB_HOST` | Postgres host |
| `DB_PORT` | Postgres port |
| `DB_USERNAME` | Postgres username |
| `DB_PASSWORD` | Postgres password |
| `DB_DATABASE` | Postgres database name |

Configured in [`config/ormconfig.js`](./config/ormconfig.js) via `typeorm`; connection is memoized in [`config/db.js`](./config/db.js) / [`config/pool.js`](./config/pool.js).

## Dependencies

- `pg`, `typeorm`
- `dayjs`
- `dotenv`

## Deploy

Zip `index.mjs`, `config/`, and `node_modules/` and upload as the Lambda's deployment package. Trigger via the SQS queue populated by `enqueueWebhookDataToSQS`.

> **Note:** stored-procedure calls are built via template-literal string interpolation of webhook fields (including `body_html`, which is manually escaped for single quotes) rather than parameterized query values. Worth switching to parameterized queries since the values originate from webhook payloads.
