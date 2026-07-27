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
