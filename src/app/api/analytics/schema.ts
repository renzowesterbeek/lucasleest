import { 
  DynamoDBClient, 
  CreateTableCommand, 
  KeyType, 
  ProjectionType,
  ScalarAttributeType,
  BillingMode,
  CreateTableCommandInput
} from '@aws-sdk/client-dynamodb';

// Only initialize DynamoDB client in production
const isDevelopment = process.env.NODE_ENV === 'development';

const client = !isDevelopment ? new DynamoDBClient({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
}) : null;

// Function to create the table
export async function createAnalyticsTable() {
  // Only run in production
  if (isDevelopment) {
    console.log('Skipping table creation in development');
    return null;
  }

  if (!client) {
    throw new Error('DynamoDB client not initialized');
  }

  // Table schema with Global Secondary Indexes for common queries
  const tableParams: CreateTableCommandInput = {
    TableName: 'LucasLeestAnalytics',
    KeySchema: [
      { AttributeName: 'pk', KeyType: KeyType.HASH },  // Partition key
      { AttributeName: 'sk', KeyType: KeyType.RANGE }  // Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: ScalarAttributeType.S },
      { AttributeName: 'sk', AttributeType: ScalarAttributeType.S },
      { AttributeName: 'date', AttributeType: ScalarAttributeType.S },
      { AttributeName: 'eventName', AttributeType: ScalarAttributeType.S },
      { AttributeName: 'bookId', AttributeType: ScalarAttributeType.S },
    ],
    GlobalSecondaryIndexes: [
      // GSI for querying by date across all events
      {
        IndexName: 'DateEventIndex',
        KeySchema: [
          { AttributeName: 'date', KeyType: KeyType.HASH },
          { AttributeName: 'eventName', KeyType: KeyType.RANGE }
        ],
        Projection: {
          ProjectionType: ProjectionType.ALL
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      // GSI for querying by bookId
      {
        IndexName: 'BookEventIndex',
        KeySchema: [
          { AttributeName: 'bookId', KeyType: KeyType.HASH },
          { AttributeName: 'eventName', KeyType: KeyType.RANGE }
        ],
        Projection: {
          ProjectionType: ProjectionType.ALL
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    BillingMode: BillingMode.PROVISIONED,
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  try {
    // Validate AWS credentials
    if (!process.env.ACCESS_KEY_ID || !process.env.SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials not configured');
    }

    const command = new CreateTableCommand(tableParams);
    const response = await client.send(command);
    console.log('Table created successfully:', response);
    return response;
  } catch (error) {
    if ((error as any).name === 'ResourceInUseException') {
      console.log('Table already exists');
      return null;
    }
    console.error('Error creating table:', error);
    throw error;
  }
}

// Example queries:
/*
// Get all events for a specific day
const dailyEvents = await docClient.query({
  TableName: 'LucasLeestAnalytics',
  IndexName: 'DateEventIndex',
  KeyConditionExpression: '#date = :date',
  ExpressionAttributeNames: {
    '#date': 'date'
  },
  ExpressionAttributeValues: {
    ':date': '2024-01-20'
  }
});

// Get all interactions with a specific book
const bookEvents = await docClient.query({
  TableName: 'LucasLeestAnalytics',
  IndexName: 'BookEventIndex',
  KeyConditionExpression: 'bookId = :bookId',
  ExpressionAttributeValues: {
    ':bookId': 'book123'
  }
});

// Get specific event types for a day
const specificEvents = await docClient.query({
  TableName: 'LucasLeestAnalytics',
  KeyConditionExpression: 'pk = :pk',
  ExpressionAttributeValues: {
    ':pk': 'event#book_selected#2024-01-20'
  }
});
*/ 