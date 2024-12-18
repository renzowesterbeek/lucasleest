import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';

const s3Client = new S3Client({
  region: process.env.REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

export async function GET() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME,
    });

    const response = await s3Client.send(command);
    return NextResponse.json(response.Contents || []);
  } catch (error) {
    console.error('Error listing audiobooks:', error);
    return NextResponse.json({ error: 'Failed to list audiobooks' }, { status: 500 });
  }
} 