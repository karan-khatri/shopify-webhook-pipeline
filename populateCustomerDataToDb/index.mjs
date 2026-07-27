import dayjs from "dayjs";
import DbConnection from "./config/db.js";

export const handler = async ({ Records }) => {
  try {
    if (Records && Array.isArray(Records) && Records.length > 0) {
      const client = await DbConnection.getConnection();

      for (const record of Records) {
        // console.log("record", record);

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
          email,
          first_name,
          last_name,
          created_at,
          updated_at,
          orders_count,
          state,
          note,
          tax_exempt,
          tags,
          currency,
          phone,
          default_address: { company, address1, address2, city, province, country, zip },
        } = body;

        // insert to db
        const populateCustomerDataQuery = `
          SELECT POPULATE_SHOPIFY_CUSTOMER_WEBHOOK_DATA (
            '${headers["X-Shopify-Shop-Domain"]}',
            '${id ?? ""}',
            '${email ?? ""}',
            '${
              created_at
                ? dayjs(created_at).format("YYYY-MM-DD HH:mm:ss")
                : dayjs().format("YYYY-MM-DD HH:mm:ss")
            }',
            '${
              updated_at
                ? dayjs(updated_at).format("YYYY-MM-DD HH:mm:ss")
                : dayjs().format("YYYY-MM-DD HH:mm:ss")
            }',
            '${first_name ?? ""}',
            '${last_name ?? ""}',
            '${state ?? ""}',
            '${note ?? ""}',
            '${tax_exempt ?? ""}',
            '${currency ?? ""}',
            '${phone ?? ""}',
            '${orders_count ?? ""}',
            '${tags ?? ""}',
            '${company ?? ""}',
            '${address1 ?? ""}',
            '${address2 ?? ""}',
            '${city ?? ""}',
            '${province ?? ""}',
            '${country ?? ""}}',
            '${zip ?? ""}'
          )
        `;

        console.log("populateCustomerDataQuery", populateCustomerDataQuery);
        const result = await client.query(populateCustomerDataQuery);

        console.log(result, "result");
      }
    }
  } catch (error) {
    console.error(error?.message);
    throw new Error(error);
  }
};