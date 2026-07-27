import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { v4 as uuidv4 } from 'uuid';
import { uploadFile } from "./service/s3.js";
import zlib from "zlib";

export const handler = async (event) => {
  let response = {}

  
  try {
    
    let body;
    let headers;
    
    try {
      const tempBody = JSON.parse(event.body);
      body = tempBody;
    } catch (err){
      body = event.body;
    }
    
    try {
      const tempHeaders = JSON.parse(event.headers);
      headers = tempHeaders;
    } catch (err){
      headers = event.headers;
    }

    const fileDirectory = `${
      headers["X-Shopify-Shop-Domain"] ?? "shopify-domain"
    }/${dayjs().year()}/${headers["X-Shopify-Topic"] ?? "topic-name"}/${dayjs().format(
      "YYYY-MM-DD"
    )}`;

    // upload to s3 bucket
    const compressedData = zlib.gzipSync(JSON.stringify({ headers, body }));

    await uploadFile(
      `${fileDirectory}/${headers["X-Shopify-Webhook-Id"]}.json.gz`,
      compressedData
    );
    

    const WebHookProcessorSQSClient = new SQSClient({
      region: process.env.SQS_REGION
    });
    
    
    const sendMessageCommandInput = {
      QueueUrl: process.env.SQS_URL,
      MessageBody: JSON.stringify({headers, body}),
      MessageGroupId: uuidv4(),
      MessageDeduplicationId: uuidv4()
    };
    
    const sendMessageCommand = new SendMessageCommand(sendMessageCommandInput);

    const sendMessageResponse = await WebHookProcessorSQSClient.send(sendMessageCommand);
    
    response = {
      statusCode: 200,
      body: JSON.stringify(sendMessageResponse),
    };
    
  
  } catch(err){
    response.statusCode = 500;
    response.body = err?.message
    console.error(err)
  }
  
  
  return response;
};
