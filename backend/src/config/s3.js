import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Upload a file buffer to S3.
 * @returns The S3 key (NOT a public URL)
 */
export async function uploadToS3(file, prefix = 'uploads') {
  const ext = file.originalname?.split('.').pop() || 'bin';
  const key = `${prefix}/${uuidv4()}.${ext}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    // No public-read ACL — access only via signed URLs
  }));

  return key;
}

export async function deleteFromS3(key) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}
