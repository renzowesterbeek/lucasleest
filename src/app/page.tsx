'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Book } from '@/types/book';
import Image from 'next/image';

// Dynamically import AudioPlayer with no SSR
const AudioPlayer = dynamic(
  () => import('@/components/AudioPlayer').then((mod) => mod.default),
  { ssr: false }
);

const FEEDBACK_COOKIE_NAME = 'book_feedback';

export default function Home() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const [activeDescription, setActiveDescription] = useState<string | null>(null);
  const [isSidebarClosing, setIsSidebarClosing] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [userFeedback, setUserFeedback] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load user feedback from cookie
    const loadUserFeedback = () => {
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        try {
          acc[key] = decodeURIComponent(value);
        } catch {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      if (cookies[FEEDBACK_COOKIE_NAME]) {
        try {
          setUserFeedback(JSON.parse(cookies[FEEDBACK_COOKIE_NAME]));
        } catch (e) {
          console.error('Error parsing feedback cookie:', e);
        }
      }
    };

    loadUserFeedback();
  }, []);

  const handleCloseSidebar = () => {
    setIsSidebarClosing(true);
    setTimeout(() => {
      setIsSidebarClosing(false);
      setIsSidebarVisible(false);
      setActiveDescription(null);
    }, 300); // Match this with the animation duration
  };

  // Filter books based on search query
  const filteredBooks = books.filter((book) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      book.title.toLowerCase().includes(searchLower) ||
      book.author.toLowerCase().includes(searchLower) ||
      (descriptions[book.id] || book.description || '').toLowerCase().includes(searchLower) ||
      (transcripts[book.id] || '').toLowerCase().includes(searchLower)
    );
  });

  useEffect(() => {
    async function fetchBooks() {
      try {
        const response = await fetch('/api/books');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load books');
        }

        setBooks(data.books);

        // Fetch descriptions and transcripts for books
        const descriptionTexts: Record<string, string> = {};
        const transcriptTexts: Record<string, string> = {};

        await Promise.all(
          data.books.map(async (book: Book) => {
            // Fetch description if it's a text file
            if (book.description?.endsWith('.txt')) {
              try {
                const response = await fetch(`/api/get-signed-url?key=${encodeURIComponent(book.description)}`);
                const data = await response.json();
                if (response.ok) {
                  const textResponse = await fetch(data.url);
                  const text = await textResponse.text();
                  descriptionTexts[book.id] = text;
                }
              } catch (err) {
                console.error('Error fetching description:', err);
              }
            }

            // Fetch transcript if available
            if (book.audioTranscript) {
              try {
                const response = await fetch(`/api/get-signed-url?key=${encodeURIComponent(book.audioTranscript)}`);
                const data = await response.json();
                if (response.ok) {
                  const textResponse = await fetch(data.url);
                  const text = await textResponse.text();
                  transcriptTexts[book.id] = text;
                }
              } catch (err) {
                console.error('Error fetching transcript:', err);
              }
            }
          })
        );

        setDescriptions(descriptionTexts);
        setTranscripts(transcriptTexts);

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

  const handleBookClick = (book: Book) => {
    // If selecting a different book, reset the player first
    if (selectedBook?.id !== book.id) {
      setSelectedBook(null);
      // Small delay to ensure the player is fully reset before setting the new book
      setTimeout(() => {
        setSelectedBook(book);
      }, 50);
    }
  };

  const handleDescriptionClick = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation(); // Prevent triggering the book selection
    if (activeDescription === bookId) {
      handleCloseSidebar();
    } else {
      setActiveDescription(bookId);
      setIsSidebarClosing(false);
      // Set visible in the next frame to ensure the animation triggers
      requestAnimationFrame(() => {
        setIsSidebarVisible(true);
      });
    }
  };

  const handleFeedback = async (bookId: string, feedbackType: 'positive' | 'negative') => {
    try {
      // If clicking the same feedback type again, we'll remove it
      const isUnsetting = userFeedback[bookId] === feedbackType;
      
      const response = await fetch('/api/books/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId,
          feedback: feedbackType,
          unset: isUnsetting
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      // Update local state to reflect the feedback
      setUserFeedback(prev => {
        const newFeedback = { ...prev };
        if (isUnsetting) {
          delete newFeedback[bookId];
        } else {
          newFeedback[bookId] = feedbackType;
        }
        return newFeedback;
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

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
    <div className="min-h-screen">
      {selectedBook && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-white border-t border-gray-200 transform transition-transform duration-300 ease-out">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex-grow">
                <AudioPlayer
                  bookKey={selectedBook.audioLink}
                  title={selectedBook.title}
                />
              </div>
              <div className="flex items-center gap-4 ml-4">
                <button
                  onClick={() => handleFeedback(selectedBook.id, 'positive')}
                  disabled={userFeedback[selectedBook.id] !== undefined && userFeedback[selectedBook.id] !== 'positive'}
                  className={`p-2 transition-colors ${
                    userFeedback[selectedBook.id] === 'positive'
                      ? 'text-green-600'
                      : userFeedback[selectedBook.id]
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-green-600'
                  }`}
                  aria-label="Positieve feedback"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </button>
                <button
                  onClick={() => handleFeedback(selectedBook.id, 'negative')}
                  disabled={userFeedback[selectedBook.id] !== undefined && userFeedback[selectedBook.id] !== 'negative'}
                  className={`p-2 transition-colors ${
                    userFeedback[selectedBook.id] === 'negative'
                      ? 'text-red-600'
                      : userFeedback[selectedBook.id]
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-red-600'
                  }`}
                  aria-label="Negatieve feedback"
                >
                  <svg className="w-6 h-6 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${selectedBook ? 'mt-32' : ''} transition-all duration-300 ease-out`}>
        <div className="mb-8">
          <div className="relative transition-all duration-200 ease-out focus-within:scale-[1.01]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek op titel, auteur of beschrijving..."
              className="block w-full rounded-xl border-0 py-4 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all duration-200 ease-out shadow-sm focus:shadow-lg"
            />
          </div>
        </div>

        {/* Description Panel - As sliding sidebar */}
        {(activeDescription || isSidebarVisible) && (
          <>
            <div 
              className={`fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-50 transition-opacity duration-300 ${
                isSidebarClosing ? 'opacity-0' : 'opacity-100'
              }`}
              onClick={handleCloseSidebar}
            />
            <div 
              className={`fixed right-0 top-0 h-screen w-[480px] bg-white shadow-xl z-50 transform transition-transform duration-300 ease-out pt-16 flex flex-col ${
                isSidebarVisible && !isSidebarClosing ? 'translate-x-0' : 'translate-x-full'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-xl font-medium text-gray-900">
                        {books.find(b => b.id === activeDescription)?.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {books.find(b => b.id === activeDescription)?.author}
                      </p>
                    </div>
                    <button
                      onClick={handleCloseSidebar}
                      className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                      aria-label="Sluit beschrijving"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="prose prose-sm">
                    <p className="text-gray-600 whitespace-pre-line">
                      {activeDescription ? (descriptions[activeDescription] || books.find(b => b.id === activeDescription)?.description) : ''}
                    </p>
                  </div>

                  <div className="mt-8 border-t border-gray-200 pt-6">
                    <h5 className="text-sm font-medium text-gray-900 mb-4">Deel dit boek</h5>
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const book = books.find(b => b.id === activeDescription);
                          const text = `Luister naar ${book?.title} van ${book?.author} op Lucas Leest`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-[#25D366] text-white hover:bg-opacity-90 transition-colors"
                        aria-label="Deel via WhatsApp"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const book = books.find(b => b.id === activeDescription);
                          const text = `Luister naar ${book?.title} van ${book?.author} op Lucas Leest`;
                          window.open(`mailto:?subject=${encodeURIComponent(book?.title || '')}&body=${encodeURIComponent(text)}`, '_blank');
                        }}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 text-white hover:bg-opacity-90 transition-colors"
                        aria-label="Deel via email"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const book = books.find(b => b.id === activeDescription);
                          const text = `Luister naar ${book?.title} van ${book?.author} op Lucas Leest`;
                          navigator.clipboard.writeText(text).then(() => {
                            // You might want to show a toast notification here
                            alert('Link gekopieerd!');
                          });
                        }}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-opacity-90 transition-colors"
                        aria-label="Kopieer link"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 animate-fade-in">
          {filteredBooks.map((book, index) => (
            <div
              key={book.id}
              className="group relative flex flex-col space-y-3 rounded-xl border border-gray-200/50 bg-white px-4 py-4 shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-gray-300 cursor-pointer transition-all duration-200 ease-out"
              onClick={() => handleBookClick(book)}
              style={{
                animationDelay: `${index * 50}ms`
              }}
            >
              {coverUrls[book.id] && (
                <div className="relative w-full aspect-[3/4] mb-4 rounded-lg overflow-hidden">
                  <Image
                    src={coverUrls[book.id]}
                    alt={`Omslag van ${book.title}`}
                    fill
                    className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  <button
                    onClick={(e) => handleDescriptionClick(e, book.id)}
                    className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    aria-label="Toon beschrijving"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200">{book.title}</h3>
                <p className="text-sm text-gray-600">{book.author}</p>
              </div>
              {book.libraryLink && (
                <a
                  href={book.libraryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  Bekijk in de bibliotheek →
                </a>
              )}
            </div>
          ))}
        </div>

        {filteredBooks.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <p className="text-gray-600">Geen boeken gevonden.</p>
          </div>
        )}
      </div>
    </div>
  );
}
