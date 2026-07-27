# populateCustomerDataToDb

Downstream consumer in the [Shopify webhook pipeline](../README.md). Triggered by the SQS queue that [`enqueueWebhookDataToSQS`](../enqueueWebhookDataToSQS) publishes to; upserts Shopify customer webhook data into Postgres.

## What it does

1. Iterates the SQS `Records` in the Lambda event.
2. Parses the (possibly double-encoded) `body`/`headers` out of each record.
3. Destructures customer fields (`id`, `email`, `first_name`, `last_name`, address, etc.) from the payload.
4. Calls the `POPULATE_SHOPIFY_CUSTOMER_WEBHOOK_DATA` Postgres stored procedure with those fields, keyed by `X-Shopify-Shop-Domain`.

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
