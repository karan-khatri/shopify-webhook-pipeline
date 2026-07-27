import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import dotEnv from 'dotenv';

dotEnv.config({
  path: '.env',
});


const s3Client = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_BUCKET_ACCESS_KEY || "",
    secretAccessKey: process.env.AWS_BUCKET_SECRET_KEY || "",
  },
});

export const uploadFile = async (fileName, file) => {
  try {
    console.log("Uploading to S3: ", fileName);

    const parallelUploads3 = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
        Body: file,
        ContentEncoding: "gzip",
        ContentType: "application/gzip",
      },
      partSize: 1024 * 1024 * 8,
      leavePartsOnError: false,
    });

    const uploadResponse = await parallelUploads3.done();
    console.log("Successfully uploaded data to S3");
    return uploadResponse;
  } catch (error) {
    console.log("Error Uploading to S3: ", error?.message);
  }
};
