import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// Only initialize DynamoDB client in production
const isDevelopment = process.env.NODE_ENV === 'development';

// Initialize DynamoDB client only in production
const client = !isDevelopment ? new DynamoDBClient({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
}) : null;

const docClient = !isDevelopment && client ? DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
}) : null;

export async function POST(request: Request) {
  try {
    // In development, just log the event
    if (isDevelopment) {
      const body = await request.json();
      console.log('Analytics event (development):', body);
      return NextResponse.json({ success: true, environment: 'development' });
    }

    // Validate AWS credentials in production
    if (!process.env.ACCESS_KEY_ID || !process.env.SECRET_ACCESS_KEY) {
      console.error('AWS credentials not configured');
      return NextResponse.json(
        { error: 'Analytics service not properly configured' },
        { status: 500 }
      );
    }

    if (!docClient) {
      console.error('DynamoDB client not initialized');
      return NextResponse.json(
        { error: 'Analytics service not initialized' },
        { status: 500 }
      );
    }

    // UTC time is used in the database
    const body = await request.json();
    const { event, properties, timestamp } = body;

    // Add context to the event
    const context = {
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      environment: process.env.NODE_ENV,
    };

    // Create a composite sort key for efficient querying
    const dateTime = new Date(timestamp);
    const dateStr = dateTime.toISOString().split('T')[0];
    const timeStr = dateTime.toISOString().split('T')[1].split('.')[0];

    // Store event in DynamoDB
    await docClient.send(new PutCommand({
      TableName: 'LucasLeestAnalytics',
      Item: {
        // Partition key: event#YYYY-MM-DD (for efficient queries per event per day)
        pk: `event#${event}#${dateStr}`,
        // Sort key: HH:mm:ss (for time-based sorting within a day)
        sk: timeStr,
        // Additional fields
        event,
        properties,
        context,
        timestamp,
        // GSI fields for different access patterns
        date: dateStr,
        eventName: event,
        // If it's a book event, add the bookId for querying
        ...(properties?.bookId && { bookId: properties.bookId }),
        // If it's a search event, add the query for analysis
        ...(properties?.query && { searchQuery: properties.query.toLowerCase() }),
      },
    }));

    return NextResponse.json({ success: true, environment: 'production' });
  } catch (error) {
    console.error('Analytics error:', error);
    // More detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to track event', details: errorMessage },
      { status: 500 }
    );
  }
} 