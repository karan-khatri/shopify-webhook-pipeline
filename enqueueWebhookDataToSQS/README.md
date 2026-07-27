# enqueueWebhookDataToSQS

Entry point of the [Shopify webhook pipeline](../README.md). Receives a raw Shopify webhook (via API Gateway), archives the payload to S3, and forwards it to an SQS FIFO queue for downstream processing.

## What it does

1. Parses `event.body` and `event.headers` (falls back to the raw value if JSON parsing fails).
2. Builds an S3 key: `{shop-domain}/{year}/{shopify-topic}/{YYYY-MM-DD}/{webhook-id}.json.gz`.
3. Gzips `{ headers, body }` and uploads it to S3 ([`service/s3.js`](./service/s3.js)).
4. Sends `{ headers, body }` as a message to an SQS FIFO queue, with a fresh `MessageGroupId` / `MessageDeduplicationId` per message.
5. Returns `200` with the SQS response, or `500` with the error message on failure.

## Environment variables

| Variable | Used for |
|---|---|
| `AWS_BUCKET_REGION` | S3 client region |
| `AWS_BUCKET_ACCESS_KEY` | S3 access key |
| `AWS_BUCKET_SECRET_KEY` | S3 secret key |
| `AWS_BUCKET_NAME` | Destination bucket for archived payloads |
| `SQS_REGION` | SQS client region |
| `SQS_URL` | Destination FIFO queue URL |

## Expected Shopify headers

- `X-Shopify-Shop-Domain`
- `X-Shopify-Topic`
- `X-Shopify-Webhook-Id`

## Dependencies

- `@aws-sdk/client-sqs`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`
- `uuid`
- `dayjs`
- `zlib`

## Deploy

Zip `index.mjs`, `service/`, and `node_modules/` and upload as the Lambda's deployment package (or `zip -r function.zip .` after `npm install --omit=dev`). Trigger via API Gateway.

> **Note:** `index.mjs` calls `dayjs()` but does not currently `import dayjs from "dayjs"` at the top of the file, even though it's a listed dependency — worth verifying this isn't erroring in production.
