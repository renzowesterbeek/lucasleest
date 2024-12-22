import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { NextResponse } from 'next/server';

const client = new DynamoDBClient({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const FEEDBACK_COOKIE_NAME = 'book_feedback';

export async function POST(request: Request) {
  try {
    const { bookId, feedback, unset } = await request.json();

    if (!bookId || !feedback || !['positive', 'negative'].includes(feedback)) {
      return NextResponse.json(
        { error: 'Invalid feedback data' },
        { status: 400 }
      );
    }

    // Check if user has already given feedback for this book
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(cookie => {
        const [key, value] = cookie.trim().split('=');
        try {
          return [key, decodeURIComponent(value)];
        } catch {
          return [key, value];
        }
      })
    );

    let userFeedback: Record<string, string> = {};
    if (cookies[FEEDBACK_COOKIE_NAME]) {
      try {
        userFeedback = JSON.parse(cookies[FEEDBACK_COOKIE_NAME]);
      } catch (e) {
        console.error('Error parsing feedback cookie:', e);
      }
    }

    // Update the book record with the feedback
    const command = new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'books',
      Key: {
        id: bookId,
      },
      UpdateExpression: `ADD ${feedback}Feedback :value`,
      ExpressionAttributeValues: {
        ':value': unset ? -1 : 1,
      },
      ReturnValues: 'NONE',
    });

    await docClient.send(command);

    // Update the cookie
    if (unset) {
      delete userFeedback[bookId];
    } else {
      userFeedback[bookId] = feedback;
    }
    
    // Create response with updated cookie
    const response = NextResponse.json(
      { message: 'Feedback stored successfully' },
      { status: 200 }
    );

    // Set cookie with 1 year expiration
    response.cookies.set({
      name: FEEDBACK_COOKIE_NAME,
      value: JSON.stringify(userFeedback),
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      path: '/',
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error('Error storing feedback:', error);
    return NextResponse.json(
      { error: 'Failed to store feedback' },
      { status: 500 }
    );
  }
} 