import { NextResponse } from 'next/server';
import { createBook, getAllBooks } from '@/lib/dynamodb';
import type { BookInput } from '@/types/book';

export async function GET() {
  try {
    console.log('Fetching all books from DynamoDB...');
    const books = await getAllBooks();
    console.log('Successfully fetched books.');
    return NextResponse.json({ books });
  } catch (error) {
    console.error('Detailed error fetching books:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch books',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['title', 'author', 'coverImage'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const bookData: BookInput = {
      title: body.title,
      author: body.author,
      description: body.description,
      audioLink: body.audioLink || '',
      audioTranscript: body.audioTranscript || '',
      coverImage: body.coverImage,
      libraryLink: body.libraryLink,
    };

    console.log('Creating book with data:', bookData);
    const newBook = await createBook(bookData);
    console.log('Successfully created book:', newBook);

    return NextResponse.json({ 
      id: newBook.id,
      book: newBook 
    });
  } catch (error) {
    console.error('Error creating book:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create book',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 