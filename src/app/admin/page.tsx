'use client';

import { useState, useRef, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

// Dynamically import AudioPlayer with no SSR
const AudioPlayer = dynamic(
  () => import('@/components/AudioPlayer').then((mod) => mod.default),
  { ssr: false }
);

// Interface definitions for the RecensieZoeker feature
// Removing unused Review interface
// interface Review {
//   text: string;          // The actual review content
//   title?: string;        // Optional title for the review
//   sourceUrl?: string;    // URL where the review was found
//   quality?: number;      // Quality score (1-10) assigned by Claude
// }

interface Podcast {
  id: string;
  title: string;
  author: string;
  audioLink: string;
  playCount: number;
  positiveFeedback: number;
  negativeFeedback: number;
}

interface PerplexitySummary {
  content: string;
}

// Remove unused SearchResult and ReviewResponse interfaces
// interface SearchResult {
//   url: string;
// }

// interface ReviewResponse {
//   title: string;
//   content: string;
//   url: string;
//   quality: number;
// }

// Removing unused interfaces
// interface SearchResponse {
//   searchResults: SearchResult[];
// }

// interface ReviewsData {
//   reviews: ReviewResponse[];
// }

const FeedbackBar = ({ positive = 0, negative = 0 }: { positive: number; negative: number }) => {
  const total = positive + negative;
  const positivePercentage = total > 0 ? Math.round((positive / total) * 100) : 50;

  return (
    <div className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm">
      <div className="flex-grow h-2.5 rounded-full overflow-hidden bg-gray-100">
        <div className="h-full flex">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${positivePercentage}%` }}
          />
          <div 
            className="h-full bg-rose-500 transition-all duration-300"
            style={{ width: `${100 - positivePercentage}%` }}
          />
        </div>
      </div>
      <div className="flex gap-4 text-sm font-medium min-w-[100px] justify-end">
        <span className="flex items-center gap-2 text-emerald-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          {positive}
        </span>
        <span className="flex items-center gap-2 text-rose-600">
          <svg className="w-5 h-5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          {negative}
        </span>
      </div>
    </div>
  );
};

export default function PodcastAdminPage() {
  const router = useRouter();
  const { isAuthenticated, isInitializing, isAdmin } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);

  // State management - MOVED ALL STATE HOOKS BEFORE CONDITIONAL RETURNS
  const [summary, setSummary] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [libraryLink, setLibraryLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [selectedBook, setSelectedBook] = useState<Podcast | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [editedScript, setEditedScript] = useState<string | null>(null);
  const [generatedDescription, setGeneratedDescription] = useState<string | null>(null);
  const [editedDescription] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [coverFile, setCoverFile] = useState<File>();
  const [currentPodcastId, setCurrentPodcastId] = useState<string | null>(null);
  const [currentBookTitle, setCurrentBookTitle] = useState<string | null>(null);

  // Define fetchPodcasts function before using it
  const fetchPodcasts = async () => {
    try {
      // First fetch all books
      const booksResponse = await fetch('/api/books', {
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      if (!booksResponse.ok) {
        const errorData = await booksResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${booksResponse.status}`);
      }
      
      const booksData = await booksResponse.json();
      
      if (!Array.isArray(booksData.books)) {
        throw new Error('Invalid response format');
      }

      // Then fetch analytics data for play counts
      const analyticsResponse = await fetch('/api/analytics/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'audio_played',
        }),
      });

      if (!analyticsResponse.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const analyticsData = await analyticsResponse.json();
      const playCountsByBook = analyticsData.stats || {};

      const processedPodcasts = booksData.books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        audioLink: book.audioLink,
        playCount: playCountsByBook[book.id] || 0,
        positiveFeedback: Number(book.positiveFeedback) || 0,
        negativeFeedback: Number(book.negativeFeedback) || 0
      }));

      console.log('Processed podcasts:', processedPodcasts);

      setPodcasts(processedPodcasts);
    } catch (error) {
      console.error('Failed to fetch podcasts:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch podcasts');
    }
  };

  // Redirect to login if not authenticated or not an admin
  useEffect(() => {
    if (!isInitializing && (!isAuthenticated || !isAdmin)) {
      router.push('/login');
    }
  }, [isAuthenticated, isInitializing, isAdmin, router]);

  // Add podcast fetching effect right after the first effect for consistent hook ordering
  useEffect(() => {
    fetchPodcasts();
  }, []);

  // Show loading state while checking authentication
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Checking authentication...</div>
      </div>
    );
  }

  // Don't render anything if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  const handleGenerateSummary = async () => {
    if (!title || !author) {
      setError('Title and author are required');
      return;
    }

    setIsGeneratingSummary(true);
    setError(null);
    setSummary(null);

    try {
      const response = await fetch('/api/books/perplexity-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, author }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate summary');
      }

      const data: PerplexitySummary = await response.json();
      setSummary(data.content);
      setSuccessMessage('Samenvatting succesvol gegenereerd!');
    } catch (error) {
      console.error('Summary generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateScript = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setGeneratedScript(null);
    setIsLoading(true);

    try {
      if (!formRef.current) {
        throw new Error('Form not found');
      }

      if (!summary) {
        throw new Error('Please generate a summary first');
      }

      const formData = new FormData(formRef.current);
      const bookTitle = formData.get('title') as string;
      const bookAuthor = formData.get('author') as string;
      
      let newCoverKey = 'default-cover.jpg'; // Default cover image key

      // Only handle cover image upload if a file is selected
      if (coverFile) {
        const params = new URLSearchParams({
          filename: coverFile.name,
          type: 'cover'
        });
        const uploadUrlResponse = await fetch(`/api/get-upload-url?${params.toString()}`);
        if (!uploadUrlResponse.ok) {
          const error = await uploadUrlResponse.json();
          throw new Error(error.error || 'Failed to get upload URL');
        }
        
        const { url: uploadUrl, key: coverKey } = await uploadUrlResponse.json();
        newCoverKey = coverKey;

        // Upload the cover file
        await fetch(uploadUrl, {
          method: 'PUT',
          body: coverFile,
          headers: {
            'Content-Type': coverFile.type,
          },
        });
      }
      
      const newBookData = {
        title: bookTitle,
        author: bookAuthor,
        libraryLink: formData.get('libraryLink') as string || undefined,
        description: (formData.get('description') as string || 'Generated by Claude').trim(),
        summary: editedSummary || summary,
        coverImage: newCoverKey,
      };

      // Generate the script
      const scriptResponse = await fetch('/api/podcasts/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: bookTitle,
          author: bookAuthor,
          libraryLink: newBookData.libraryLink,
          coverImage: newCoverKey,
          reviews: [editedSummary || summary],
        }),
      });

      const scriptData = await scriptResponse.json();

      if (!scriptResponse.ok) {
        throw new Error(scriptData.error || 'Failed to generate script');
      }

      setGeneratedScript(scriptData.script);
      setEditedScript(scriptData.script);
      setGeneratedDescription(scriptData.description);

      // Create the book entry right after generating the script
      const bookResponse = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newBookData,
          coverImage: newCoverKey,
          script: scriptData.script,
        }),
      });

      const bookResult = await bookResponse.json();

      if (!bookResponse.ok) {
        throw new Error(bookResult.error || 'Failed to create book');
      }

      if (!bookResult.id) {
        throw new Error('No book ID returned from server');
      }

      console.log('Book created with ID:', bookResult.id);
      setCurrentPodcastId(bookResult.id);
      setCurrentBookTitle(bookTitle);
      setSuccessMessage('Script succesvol gegenereerd! Je kunt nu audio genereren.');

      // Refresh the list of books
      fetchPodcasts();

    } catch (error) {
      console.error('Script generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate script');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!editedScript) {
      setError('Please generate and edit a script first');
      return;
    }

    if (!generatedDescription && !editedDescription) {
      setError('Description is missing. Please generate a script first to get a description.');
      return;
    }

    setIsGeneratingAudio(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/podcasts/audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: currentPodcastId,
          title: currentBookTitle,
          script: editedScript,
          description: editedDescription || generatedDescription || 'Generated by AI'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      setSuccessMessage('Audio generation started. This may take a few minutes.');
      
      // Refresh the list of books after a delay to show the updated audio status
      setTimeout(fetchPodcasts, 5000);
    } catch (error: unknown) {
      console.error('Error generating audio:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handlePodcastPlay = async (podcast: Podcast) => {
    try {
      await fetch('/api/analytics/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId: podcast.id,
          event: 'audio_played'
        }),
      });
    } catch (error: unknown) {
      console.error('Error recording analytics:', error);
    }
    setSelectedBook(podcast);
  };

  // Fetch a summary for a book from Perplexity
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleGenerateSummaryForBook = async (bookId: string, bookTitle: string) => {
    if (!bookId || !bookTitle) {
      setError('Book information is missing');
      return;
    }

    setCurrentPodcastId(bookId);
    setCurrentBookTitle(bookTitle);
    setIsGeneratingSummary(true);
    setError(null);
    setSummary(null);

    try {
      const response = await fetch(`/api/books/${bookId}/summary`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSummary(data.summary || 'No summary available');
      setSuccessMessage(`Summary generated for ${bookTitle}`);
    } catch (error: unknown) {
      console.error('Error fetching summary:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">Manage your podcasts and book reviews</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Book Management */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Book Management</h2>
              <form ref={formRef} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
                      Author
                    </label>
                    <input
                      type="text"
                      id="author"
                      name="author"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="libraryLink" className="block text-sm font-medium text-gray-700 mb-1">
                    Library Link
                  </label>
                  <input
                    type="url"
                    id="libraryLink"
                    name="libraryLink"
                    value={libraryLink}
                    onChange={(e) => setLibraryLink(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cover Image (Optional)
                  </label>
                  <FileUpload
                    onChange={setCoverFile}
                    accept="image/*"
                    label="Upload Cover Image"
                    helpText="PNG, JPG, GIF up to 10MB. If not provided, a default cover will be used."
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingSummary ? 'Generating Summary...' : 'Generate Summary'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateScript({ 
                      preventDefault: () => {} 
                    } as React.FormEvent<HTMLFormElement>)}
                    disabled={isLoading || isGeneratingSummary || !title || !author}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {isLoading ? 'Generating...' : 'Generate Script'}
                  </button>
                </div>
              </form>
            </div>

            {summary && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Summary</h3>
                <textarea
                  value={editedSummary || summary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {generatedScript && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Script</h3>
                <textarea
                  value={editedScript || generatedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio}
                  className="mt-4 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingAudio ? 'Generating Audio...' : 'Generate Audio'}
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Podcast List */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Podcast Library</h2>
              <div className="space-y-4">
                {podcasts.map((podcast) => (
                  <div
                    key={podcast.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{podcast.title}</h3>
                        <p className="text-sm text-gray-500">{podcast.author}</p>
                      </div>
                      <button
                        onClick={() => handlePodcastPlay(podcast)}
                        className="p-2 text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full"
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-3">
                      <FeedbackBar positive={podcast.positiveFeedback} negative={podcast.negativeFeedback} />
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {podcast.playCount} plays
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{successMessage}</p>
          </div>
        )}

        {selectedBook && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Now Playing</h3>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <AudioPlayer
                bookKey={selectedBook.audioLink}
                title={selectedBook.title}
                bookId={selectedBook.id}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}