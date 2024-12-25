import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const MAX_ATTEMPTS = 3;  // Maximum login attempts
const WINDOW_SIZE = 15 * 60;  // 15 minutes in seconds
const TABLE_NAME = 'LucasLeestRateLimit';

export interface RateLimitInfo {
  remainingAttempts: number;
  resetTime: Date;
  isBlocked: boolean;
}

export async function checkRateLimit(ip: string): Promise<RateLimitInfo> {
  const now = Math.floor(Date.now() / 1000);  // Current time in seconds
  
  try {
    // Get current rate limit record for IP
    const response = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { ip },
      })
    );

    const record = response.Item;
    
    if (!record || record.ttl < now) {
      // No record or expired record, create new one
      const ttl = now + WINDOW_SIZE;
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            ip,
            attempts: 1,
            ttl,
            firstAttempt: now,
          },
        })
      );
      
      return {
        remainingAttempts: MAX_ATTEMPTS - 1,
        resetTime: new Date((now + WINDOW_SIZE) * 1000),
        isBlocked: false,
      };
    }

    // Increment attempts
    const attempts = record.attempts + 1;
    const ttl = record.ttl;
    
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ip,
          attempts,
          ttl,
          firstAttempt: record.firstAttempt,
        },
      })
    );

    return {
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempts),
      resetTime: new Date(ttl * 1000),
      isBlocked: attempts >= MAX_ATTEMPTS,
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // In case of error, allow the request but with a warning
    return {
      remainingAttempts: 1,
      resetTime: new Date(now + WINDOW_SIZE * 1000),
      isBlocked: false,
    };
  }
} 