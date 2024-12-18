import { NextResponse } from 'next/server';
import { getBook, updateBook, deleteBook } from '@/lib/dynamodb';
import type { BookInput } from '@/types/book';

export async function GET(request, { params }) {
  try {
    const book = await getBook(params.id);
    
    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(book);
  } catch (error) {
    console.error('Error fetching book:', error);
    return NextResponse.json(
      { error: 'Failed to fetch book' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const updates: Partial<BookInput> = await request.json();
    const updatedBook = await updateBook(params.id, updates);
    
    if (!updatedBook) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedBook);
  } catch (error) {
    console.error('Error updating book:', error);
    return NextResponse.json(
      { error: 'Failed to update book' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await deleteBook(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json(
      { error: 'Failed to delete book' },
      { status: 500 }
    );
  }
} 