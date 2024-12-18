import { NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

const getContentType = (filename: string, type: string): string => {
  if (type === 'audio') return 'audio/mpeg';
  if (type === 'transcript') return 'text/plain';
  
  // For cover images, determine the content type based on file extension
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
};

export async function GET(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.S3_BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME is not configured');
    }
    if (!process.env.ACCESS_KEY_ID || !process.env.SECRET_ACCESS_KEY) {
      throw new Error('ACCESS_KEY_ID or SECRET_ACCESS_KEY is not configured');
    }

    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');
    const type = searchParams.get('type');

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Filename is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!type || !['audio', 'transcript', 'cover'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fileExtension = filename.split('.').pop();
    const key = `${type}/${uuidv4()}.${fileExtension}`;
    const contentType = getContentType(filename, type);

    console.log('Generating signed URL for:', {
      bucket: process.env.S3_BUCKET_NAME,
      key,
      contentType,
      type
    });

    const putObjectCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, putObjectCommand, { expiresIn: 3600 });

    return new Response(JSON.stringify({ url, key }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    
    // More detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(JSON.stringify({ 
      error: 'Failed to generate upload URL',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 