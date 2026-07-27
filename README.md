# Shopify Webhook Pipeline

Three AWS Lambda functions that ingest Shopify webhooks, archive the raw payload, and populate a Postgres database with customer and product data.

## Architecture

```
Shopify Webhook
      │
      ▼
┌─────────────────────────┐
│ enqueueWebhookDataToSQS  │  API Gateway-triggered
│  - gzip + archive to S3  │
│  - push message to SQS   │
└────────────┬─────────────┘
             │  (SQS FIFO queue)
             ├─────────────────────────────┐
             ▼                             ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│ populateCustomerDataToDb   │   │ populateProductsDataToDB  │
│  - SQS-triggered           │   │  - SQS-triggered          │
│  - upserts customer data   │   │  - matches tenant tags,   │
│    via stored procedure    │   │    upserts product/variant│
└───────────────────────────┘   └──────────────────────────┘
```

Each Shopify webhook (e.g. `customers/update`, `products/update`) hits the same entry Lambda, which archives the raw payload to S3 (partitioned by shop domain / topic / date) and forwards it to SQS. The two downstream Lambdas are triggered by SQS and route on webhook topic to update the appropriate tables via Postgres stored procedures.

## Functions

| Folder | Trigger | Purpose |
|---|---|---|
| [`enqueueWebhookDataToSQS`](./enqueueWebhookDataToSQS) | API Gateway | Receives the raw webhook, archives it to S3, enqueues it to SQS |
| [`populateCustomerDataToDb`](./populateCustomerDataToDb) | SQS | Parses customer webhook payloads and upserts into Postgres |
| [`populateProductsDataToDB`](./populateProductsDataToDB) | SQS | Parses product webhook payloads, matches tenant tags, upserts product/variant data |

See each folder's README for environment variables, dependencies, and deployment notes.

## Notes & suggestions

A few things worth a look before/after this goes up on GitHub — not blockers, just flagging what I noticed while writing these docs:

- **Possible missing import** — [`enqueueWebhookDataToSQS/index.mjs`](./enqueueWebhookDataToSQS/index.mjs) calls `dayjs()` to build the S3 file path, but the file doesn't import `dayjs` (only `SQSClient`, `uuid`, `uploadFile`, and `zlib` are imported, even though `dayjs` is listed in `package.json`). Worth confirming this isn't throwing a `ReferenceError` in production.
- **SQL built via string interpolation** — all three functions build stored-procedure calls with template literals that splice webhook fields (email, address, tags, product body, etc.) directly into the query string, rather than using parameterized queries (`pg`/`typeorm` both support parameters). Since the values ultimately originate from a webhook payload, this is worth hardening against injection/malformed data, even if Shopify is the "trusted" source today.
- **Duplicated config** — `populateCustomerDataToDb/config` and `populateProductsDataToDB/config` are byte-for-byte identical (`db.js`, `pool.js`, `ormconfig.js`). Fine to leave as-is since each Lambda needs to be a self-contained deployable, but worth knowing if one ever needs to change (you'd need to update both).
- **Deployment `.zip` files excluded** — the pre-built `*.zip` deployment packages (up to ~11MB) sitting next to each function are build artifacts (source + `node_modules`), so they're excluded via `.gitignore` rather than committed. Recommend zipping fresh at deploy time instead of keeping them in source control.
- **No secrets found** — good news: all AWS/DB credentials are read from environment variables via `dotenv`, and there are no `.env` files sitting in these folders. Nothing sensitive was in scope to `.gitignore` beyond the standard exclusions.
