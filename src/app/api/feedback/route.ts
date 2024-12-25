import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

interface FeedbackItem {
  id: string;
  type: 'feedback' | 'book_suggestion' | 'other';
  name: string;
  email: string;
  message: string;
  bookTitle?: string;
  bookAuthor?: string;
  createdAt: string;
  status: 'new' | 'read' | 'archived';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['type', 'name', 'email', 'message'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Additional validation for book suggestions
    if (body.type === 'book_suggestion') {
      if (!body.bookTitle || !body.bookAuthor) {
        return NextResponse.json(
          { error: 'Book title and author are required for book suggestions' },
          { status: 400 }
        );
      }
    }

    // Create feedback item
    const feedbackItem: FeedbackItem = {
      id: `feedback_${Date.now()}`,
      type: body.type,
      name: body.name,
      email: body.email,
      message: body.message,
      bookTitle: body.bookTitle,
      bookAuthor: body.bookAuthor,
      createdAt: new Date().toISOString(),
      status: 'new',
    };

    // Store in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: 'LucasLeestFeedback',
        Item: feedbackItem,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing feedback:', error);
    return NextResponse.json(
      { error: 'Failed to store feedback' },
      { status: 500 }
    );
  }
} 