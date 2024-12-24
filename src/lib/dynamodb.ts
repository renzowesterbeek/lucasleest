import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Book, BookInput } from '@/types/book';

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const TableName = 'LucasLeestBooks';

export async function createBook(book: BookInput): Promise<Book> {
  const now = new Date().toISOString();
  const id = `book_${Date.now()}`;

  // Ensure all required fields are present
  const newBook: Book = {
    id,
    title: book.title,
    author: book.author,
    description: book.description,
    audioLink: book.audioLink,
    audioTranscript: book.audioTranscript,
    coverImage: book.coverImage,
    libraryLink: book.libraryLink,
    createdAt: now,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName,
        Item: newBook,
      })
    );

    return newBook;
  } catch (error) {
    console.error('Error in createBook:', error);
    throw new Error(
      `Failed to create book: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function getBook(id: string): Promise<Book | null> {
  try {
    const response = await docClient.send(
      new GetCommand({
        TableName,
        Key: { id },
      })
    );

    if (!response.Item) return null;

    // Ensure the response matches our Book type
    const book = response.Item as Book;
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      audioLink: book.audioLink,
      audioTranscript: book.audioTranscript,
      coverImage: book.coverImage,
      libraryLink: book.libraryLink,
      createdAt: book.createdAt,
    };
  } catch (error) {
    console.error('Error in getBook:', error);
    throw new Error(
      `Failed to get book: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function getAllBooks(): Promise<Book[]> {
  try {
    console.log('Scanning DynamoDB table:', TableName);
    const response = await docClient.send(
      new ScanCommand({
        TableName,
      })
    );
    // console.log('Scan response:', response);
    console.log('Scan response successful');

    if (!response.Items) {
      console.log('No items found in table');
      return [];
    }

    // Ensure each item matches our Book type
    return response.Items.map(item => ({
      id: item.id,
      title: item.title,
      author: item.author,
      description: item.description,
      audioLink: item.audioLink,
      audioTranscript: item.audioTranscript,
      coverImage: item.coverImage,
      libraryLink: item.libraryLink,
      createdAt: item.createdAt,
      playCount: item.playCount || 0,
      positiveFeedback: item.positiveFeedback || 0,
      negativeFeedback: item.negativeFeedback || 0
    }));
  } catch (error) {
    console.error('Detailed error in getAllBooks:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      credentials: {
        region: process.env.REGION,
        hasAccessKey: !!process.env.ACCESS_KEY_ID,
        hasSecretKey: !!process.env.SECRET_ACCESS_KEY,
      }
    });
    throw new Error(
      `Failed to get all books: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function updateBook(id: string, updates: Partial<BookInput>): Promise<Book | null> {
  try {
    const updateExpression = 'set ' + Object.keys(updates).map(key => `#${key} = :${key}`).join(', ');
    
    const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => ({
      ...acc,
      [`#${key}`]: key,
    }), {});

    const expressionAttributeValues = Object.entries(updates).reduce((acc, [key, value]) => ({
      ...acc,
      [`:${key}`]: value,
    }), {});

    const response = await docClient.send(
      new UpdateCommand({
        TableName,
        Key: { id },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    if (!response.Attributes) return null;

    // Ensure the response matches our Book type
    const book = response.Attributes as Book;
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      audioLink: book.audioLink,
      audioTranscript: book.audioTranscript,
      coverImage: book.coverImage,
      libraryLink: book.libraryLink,
      createdAt: book.createdAt,
    };
  } catch (error) {
    console.error('Error in updateBook:', error);
    throw new Error(
      `Failed to update book: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function deleteBook(id: string): Promise<void> {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName,
        Key: { id },
      })
    );
  } catch (error) {
    console.error('Error in deleteBook:', error);
    throw new Error(
      `Failed to delete book: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
} 