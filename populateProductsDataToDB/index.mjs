import dayjs from "dayjs";
import DbConnection from "./config/db.js";

export const handler = async ({ Records }) => {
  try {
    if (Records && Array.isArray(Records) && Records.length > 0) {
      const client = await DbConnection.getConnection();

      for (const record of Records) {

        let recordBody;
        try {
          const recordBodyTemp = JSON.parse(record?.body);
          recordBody = recordBodyTemp;
        } catch (error) {
          recordBody = record?.body;
        }

        let body;
        let headers;

        try {
          const bodyTemp = JSON.parse(recordBody?.body);
          body = bodyTemp;
        } catch (error) {
          console.log("Error parsing record record?.body:", error?.message);
          body = recordBody?.body;
        }

        try {
          const headersTemp = JSON.parse(recordBody?.headers);
          headers = headersTemp;
        } catch (error) {
          console.log("Error parsing record record?.headers:", error?.message);
          headers = recordBody?.headers;
        }

        const {
          id,
          title,
          body_html,
          vendor,
          product_type,
          created_at,
          handle,
          updated_at,
          published_at,
          status,
          tags,
          options,
          variants,
        } = body;

        // stored procedure that fetches tenant tags from web settings along with tenant id
        const tenantTagsQuery = `
          SELECT * from GET_TENANT_PRODUCT_TAGS_WITH_TENANT_ID('${headers["X-Shopify-Shop-Domain"]}');
        `;
        const tenantTagsResult = await client.query(tenantTagsQuery);
        console.log(
          "tenantTagsResult --------------------------------------------------------",
          tenantTagsResult
        );

        // split product tags for checking
        const productTags = tags.split(",").map((tag) => tag.trim());

        const matchedTenantPrimaryTags = [];
        const matchedTenantSecondaryTags = [];
        const tenantPrimaryTags = tenantTagsResult?.[0]?.primaryTags ?? [];
        const tenantSecondaryTags = tenantTagsResult?.[0]?.secondaryTags ?? [];
        const matchedTenantId = tenantTagsResult?.[0]?.matched_tenant_id ?? null;

        // comparing and matching product tags with tenant tags
        if (tenantPrimaryTags.length > 0) {
          for (const tag of tenantPrimaryTags) {
            productTags.includes(tag.trim()) && matchedTenantPrimaryTags.push(tag.trim());
          }
        }

        // comparing and matching product tags with tenant tags
        if (tenantSecondaryTags.length > 0) {
          for (const tag of tenantSecondaryTags) {
            productTags.includes(tag.trim()) && matchedTenantSecondaryTags.push(tag.trim());
          }
        }

        // if no match found, return
        if (matchedTenantPrimaryTags.length === 0 && matchedTenantSecondaryTags.length === 0) {
          console.log("no match", matchedTenantPrimaryTags, matchedTenantSecondaryTags);
          return;
        }
        // else if all matched, populate product and variant data
        else if (matchedTenantPrimaryTags.length > 0) {
          const total_inventory = variants.reduce((total, variant) => {
            return total + variant.inventory_quantity;
          }, 0);

          const populateShopifyProductQuery = `
            SELECT POPULATE_PRODUCT_DATA_FROM_WEBHOOK(
              ${matchedTenantId ? `'${matchedTenantId}'` : `NULL`},
              '${id}',
              '${title}',
              '${body_html.replaceAll("'", "&apos;") ?? ""}',
              '${vendor ?? ""}',
              '${product_type ?? ""}',
              '${handle ?? ""}',
              '${total_inventory ?? 0}',
              '${status ?? ""}',
              '${tags ?? ""}',
              ${
                created_at
                  ? `'${dayjs(created_at).format("YYYY-MM-DD HH:mm:ss")}'`
                  : `'${dayjs().format("YYYY-MM-DD HH:mm:ss")}'`
              },
              ${
                updated_at
                  ? `'${dayjs(updated_at).format("YYYY-MM-DD HH:mm:ss")}'`
                  : `'${dayjs().format("YYYY-MM-DD HH:mm:ss")}'`
              },
              ${
                published_at
                  ? `'${dayjs(published_at).format("YYYY-MM-DD HH:mm:ss")}'`
                  : `'${dayjs().format("YYYY-MM-DD HH:mm:ss")}'`
              }
            );
            `;

          const productQueryResult = await client.query(populateShopifyProductQuery);
          console.log("result", productQueryResult?.[0]?.populate_product_data_from_webhook);

          for (const variant of variants) {
            const isSize = options?.[0]?.name !== "Band";

            const populateVariantQuery = `
              SELECT POPULATE_PRODUCT_VARIANT_DATA(
                ${
                  productQueryResult?.[0]?.populate_product_data_from_webhook
                    ? `'${productQueryResult?.[0]?.populate_product_data_from_webhook}'`
                    : `NULL`
                },
                '${variant?.id}',
                '${variant?.title ?? ""}',
                '${variant?.price ?? 0}',
                '${variant?.sku ?? ""}',
                ${isSize ? `NULL` : `'${variant?.option1}'`},
                ${isSize ? `NULL` : `'${variant?.option2}'`},
                ${isSize ? `'${variant?.option1}'` : `NULL`},
                '${variant?.inventory_quantity ?? 0}',
                ${variant?.inventory_item_id ? `'${variant?.inventory_item_id}'` : `NULL`},
                '${variant?.fulfillment_service ?? ""}',
                '',
                '${variant?.compare_at_price ?? 0.0}',
                '',
                '${variant?.taxable ? "TRUE" : "FALSE"}',
                '${variant?.grams ?? 0}',
                NULL,
                TRUE
              )
            `;

            await client.query(populateVariantQuery);
          }
          console.log("fully matched", matchedTenantPrimaryTags, matchedTenantSecondaryTags);
          return;

          // else if half matched, insert into temp table
        } else if (matchedTenantPrimaryTags.length === 0 && matchedTenantSecondaryTags.length > 0) {
          console.log("half matched", matchedTenantPrimaryTags, matchedTenantSecondaryTags);

          const insertIntoProductTempTableQuery = `
            INSERT INTO product_temp_table ("json_data", "created_at", "tenant_id", "tags")
            VALUES(
              '${JSON.stringify(body ?? {}).replaceAll("'", "&apos;")}', 
              '${dayjs().format("YYYY-MM-DD HH:mm:ss")}', 
              ${matchedTenantId ? `'${matchedTenantId}'` : `NULL`},
              '${matchedTenantSecondaryTags.join(",")}'
            ) RETURNING *;`;

          const result = await client.query(insertIntoProductTempTableQuery);

          console.log("result", result);
        }

        return;
      }
    }
  } catch (error) {
    console.error(error?.message);
    throw new Error(error);
  }
};