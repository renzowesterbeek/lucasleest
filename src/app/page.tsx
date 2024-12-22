'use client';

import { useState, useEffect } from 'react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Book } from '@/types/book';
import Image from 'next/image';

export default function Home() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchBooks() {
      try {
        const response = await fetch('/api/books');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load books');
        }

        setBooks(data.books);

        // Fetch descriptions for books that have a description file path
        const descriptionTexts: Record<string, string> = {};
        await Promise.all(
          data.books
            .filter((book: Book) => book.description?.endsWith('.txt'))
            .map(async (book: Book) => {
              try {
                const response = await fetch(`/api/get-signed-url?key=${encodeURIComponent(book.description!)}`);
                const data = await response.json();
                if (response.ok) {
                  // Fetch the actual content from the signed URL
                  const textResponse = await fetch(data.url);
                  const text = await textResponse.text();
                  descriptionTexts[book.id] = text;
                }
              } catch (err) {
                console.error('Error fetching description:', err);
              }
            })
        );
        setDescriptions(descriptionTexts);

        // Fetch signed URLs for all cover images
        const urls: Record<string, string> = {};
        await Promise.all(
          data.books
            .filter((book: Book) => book.coverImage)
            .map(async (book: Book) => {
              try {
                const response = await fetch(`/api/get-signed-url?key=${encodeURIComponent(book.coverImage!)}`);
                const data = await response.json();
                if (response.ok) {
                  urls[book.id] = data.url;
                }
              } catch (err) {
                console.error('Error fetching cover URL:', err);
              }
            })
        );
        setCoverUrls(urls);
      } catch (err) {
        console.error('Error loading books:', err);
        setError('Error loading books. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchBooks();
  }, []);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Boeken laden...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-700">Podcasts</h1>
          <p className="mt-2 text-sm text-gray-700">
            Hier vind je alle beschikbare podcasts
          </p>
        </div>
      </div>

      {selectedBook && (
        <div className="mb-8">
          <AudioPlayer
            bookKey={selectedBook.audioLink}
            title={selectedBook.title}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <div
            key={book.id}
            className="relative flex flex-col space-y-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400 cursor-pointer"
            onClick={() => setSelectedBook(book)}
          >
            {coverUrls[book.id] && (
              <div className="relative w-full aspect-[3/4] mb-4">
                <Image
                  src={coverUrls[book.id]}
                  alt={`Omslag van ${book.title}`}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-gray-900">{book.title}</h3>
              <p className="text-sm text-gray-600">{book.author}</p>
              <p className="text-sm text-gray-500 line-clamp-2">
                {descriptions[book.id] || book.description}
              </p>
            </div>
            {book.libraryLink && (
              <a
                href={book.libraryLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={(e) => e.stopPropagation()}
              >
                Bekijk in de bibliotheek →
              </a>
            )}
          </div>
        ))}
      </div>

      {books.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">Geen boeken gevonden.</p>
        </div>
      )}
    </div>
  );
}
