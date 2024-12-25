import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function POST(request: Request) {
  try {
    const { event } = await request.json();

    if (!event) {
      return NextResponse.json({ error: 'Event type is required' }, { status: 400 });
    }

    // Get today's date and 90 days ago for the query
    const today = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);

    const startDate = ninetyDaysAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    // Query analytics data for the specified event type
    const command = new QueryCommand({
      TableName: 'LucasLeestAnalytics',
      KeyConditionExpression: 'eventName = :event',
      ExpressionAttributeValues: {
        ':event': event
      }
    });

    try {
      const response = await docClient.send(command);
      const items = response.Items || [];

      // Aggregate play counts by bookId
      const stats = items.reduce((acc: { [key: string]: number }, item) => {
        const bookId = item.properties?.bookId;
        if (bookId) {
          acc[bookId] = (acc[bookId] || 0) + 1;
        }
        return acc;
      }, {});

      return NextResponse.json({ stats });
    } catch (dbError) {
      console.error('DynamoDB query error:', dbError);
      // If there's an error with the query, return empty stats
      return NextResponse.json({ stats: {} });
    }
  } catch (error) {
    console.error('Error in analytics stats endpoint:', error);
    // Return empty stats object instead of an error
    return NextResponse.json({ stats: {} });
  }
} 