import { s3Client } from '../config/s3.js';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const BUCKET = process.env.AWS_S3_BUCKET;

export async function uploadToS3(file, prefix = 'uploads') {
  const ext = file.originalname?.split('.').pop() || 'bin';
  const key = `${prefix}/${uuidv4()}.${ext}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key,
    Body: file.buffer, ContentType: file.mimetype,
  }));
  return key;
}

export async function deleteFromS3(key) {
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error('S3 delete error:', err.message);
  }
}
