import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

export async function POST(request: Request) {
  try {
    const { event } = await request.json();

    if (!event) {
      return NextResponse.json({ error: 'Event type is required' }, { status: 400 });
    }

    // Query analytics data using the primary key pattern
    const command = new ScanCommand({
      TableName: 'LucasLeestAnalytics',
      FilterExpression: 'eventName = :event',
      ExpressionAttributeValues: {
        ':event': event
      }
    });

    try {
      const response = await docClient.send(command);
      const items = response.Items || [];

      // Aggregate play counts by bookId
      const stats = items.reduce((acc: { [key: string]: number }, item) => {
        const bookId = item.bookId;
        if (bookId) {
          acc[bookId] = (acc[bookId] || 0) + 1;
        }
        return acc;
      }, {});

      return NextResponse.json({ stats });
    } catch (dbError) {
      console.error('DynamoDB query error:', dbError);
      return NextResponse.json({ stats: {} });
    }
  } catch (error) {
    console.error('Error in analytics stats endpoint:', error);
    return NextResponse.json({ stats: {} });
  }
} 