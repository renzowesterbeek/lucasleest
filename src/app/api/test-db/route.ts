import { NextResponse } from 'next/server';
import { createBook } from '@/lib/dynamodb';

export async function GET() {
  try {
    console.log('Testing DynamoDB connection...');

    const testBook = {
      title: 'Test Book',
      author: 'Test Author',
      description: 'This is a test book',
      audioLink: 'https://example.com/test.mp3',
      audioTranscript: 'https://example.com/test.txt',
      libraryLink: 'https://example.com/book',
      coverImage: 'https://example.com/cover.jpg'
    };

    console.log('Creating test book...');
    const newBook = await createBook(testBook);
    console.log('Created test book:', newBook);

    return NextResponse.json({
      message: 'Test successful',
      book: newBook
    });
  } catch (error) {
    console.error('Error testing DynamoDB:', error);
    return NextResponse.json(
      { error: 'Failed to test DynamoDB' },
      { status: 500 }
    );
  }
} 