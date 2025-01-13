'use client';

import { useState, useRef, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import dynamic from 'next/dynamic';

// Dynamically import AudioPlayer with no SSR
const AudioPlayer = dynamic(
  () => import('@/components/AudioPlayer').then((mod) => mod.default),
  { ssr: false }
);

interface Review {
  text: string;
  title?: string;
  sourceUrl?: string;
  quality?: number;
}

interface Podcast {
  id: string;
  title: string;
  author: string;
  audioLink: string;
  playCount: number;
  positiveFeedback: number;
  negativeFeedback: number;
}

interface SearchResult {
  url: string;
}

interface ReviewResponse {
  title: string;
  content: string;
  url: string;
  quality: number;
}

interface SearchResponse {
  searchResults: SearchResult[];
}

interface ReviewsData {
  reviews: ReviewResponse[];
}

const FeedbackBar = ({ positive = 0, negative = 0 }: { positive: number; negative: number }) => {
  const total = positive + negative;
  const positivePercentage = total > 0 ? Math.round((positive / total) * 100) : 50;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-grow h-2 rounded-full overflow-hidden bg-[#dad5dd]">
        <div className="h-full flex">
          <div 
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${positivePercentage}%` }}
          />
          <div 
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${100 - positivePercentage}%` }}
          />
        </div>
      </div>
      <div className="flex gap-3 text-sm font-medium min-w-[80px] justify-end">
        <span className="flex items-center gap-1 text-green-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          {positive}
        </span>
        <span className="flex items-center gap-1 text-red-600">
          <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          {negative}
        </span>
      </div>
    </div>
  );
};

export default function PodcastAdminPage() {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [libraryLink, setLibraryLink] = useState('');
  const [reviews, setReviews] = useState<Review[]>([{ text: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [selectedBook, setSelectedBook] = useState<Podcast | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [editedScript, setEditedScript] = useState<string | null>(null);
  const [generatedDescription, setGeneratedDescription] = useState<string | null>(null);
  const [editedDescription, setEditedDescription] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [coverFile, setCoverFile] = useState<File>();
  const [currentPodcastId, setCurrentPodcastId] = useState<string | null>(null);
  const [currentBookTitle, setCurrentBookTitle] = useState<string | null>(null);
  const [isSearchingReviews, setIsSearchingReviews] = useState(false);
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleGenerateScript = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setGeneratedScript(null);
    setIsLoading(true);

    try {
      if (!coverFile) {
        throw new Error('Please select a cover image');
      }

      if (!formRef.current) {
        throw new Error('Form not found');
      }

      const formData = new FormData(formRef.current);
      const bookTitle = formData.get('title') as string;
      const bookAuthor = formData.get('author') as string;
      
      // First upload the cover image
      const params = new URLSearchParams({
        filename: coverFile.name,
        type: 'cover'
      });
      const uploadUrlResponse = await fetch(`/api/get-upload-url?${params.toString()}`);
      if (!uploadUrlResponse.ok) {
        const error = await uploadUrlResponse.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }
      
      const { url: uploadUrl, key: newCoverKey } = await uploadUrlResponse.json();

      // Upload the cover file
      await fetch(uploadUrl, {
        method: 'PUT',
        body: coverFile,
        headers: {
          'Content-Type': coverFile.type,
        },
      });
      
      const newBookData = {
        title: bookTitle,
        author: bookAuthor,
        libraryLink: formData.get('libraryLink') as string || undefined,
        description: (formData.get('description') as string || 'Generated by Claude').trim(),
        reviews: reviews.filter(review => review.text.trim() !== '').map(review => review.text),
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
          reviews: newBookData.reviews,
        }),
      });

      const scriptData = await scriptResponse.json();

      if (!scriptResponse.ok) {
        throw new Error(scriptData.error || 'Failed to generate script');
      }

      setGeneratedScript(scriptData.script);
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
    if (!currentPodcastId || !currentBookTitle) {
      setError('No book ID or title available');
      return;
    }

    if (!generatedScript && !editedScript) {
      setError('No script available for audio generation');
      return;
    }

    if (!generatedDescription && !editedDescription) {
      setError('No description available for audio generation');
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
          script: editedScript || generatedScript,
          description: editedDescription || generatedDescription
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start audio generation');
      }

      setSuccessMessage('Audio generatie is gestart op de achtergrond. Dit kan enkele minuten duren.');
      
      // Refresh the list of books after a delay to show the updated audio status
      setTimeout(fetchPodcasts, 5000);
    } catch (error) {
      console.error('Audio generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start audio generation');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleSearchReviews = async () => {
    if (!title.trim()) {
      setError('Vul eerst een titel in');
      return;
    }
    
    setIsSearchingReviews(true);
    setError(null);
    setReviews([]);

    try {
      const response = await fetch('/api/books/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title,
          author
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }

      const data = await response.json() as SearchResponse;
      
      // Automatically fetch content for all search results
      setIsFetchingReviews(true);
      const contentResponse = await fetch('/api/books/fetch-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          urls: data.searchResults.map((r: SearchResult) => r.url),
          title,
          author
        }),
      });

      if (!contentResponse.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const reviewsData = await contentResponse.json() as ReviewsData;
      setReviews(reviewsData.reviews.map((review: ReviewResponse) => ({
        text: review.content,
        title: review.title,
        sourceUrl: review.url,
        quality: review.quality
      })));
      
      setSuccessMessage('Recensies succesvol opgehaald!');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch reviews');
    } finally {
      setIsSearchingReviews(false);
      setIsFetchingReviews(false);
    }
  };

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

  useEffect(() => {
    fetchPodcasts();
  }, []);

  const handlePodcastPlay = async (podcast: Podcast) => {
    setSelectedBook(null);
    setTimeout(() => setSelectedBook(podcast), 0);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-background-DEFAULT rounded-lg shadow">
      <h1 className="text-2xl font-semibold mb-6 text-primary">Nieuwe Podcast Creëren</h1>

      {error && (
        <div className="p-4 mb-6 rounded-md bg-error-light text-error border border-error/20">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 mb-6 rounded-md bg-primary-light text-primary border border-primary/20">
          {successMessage}
        </div>
      )}

      <form ref={formRef} onSubmit={handleGenerateScript} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-900">
            Titel
          </label>
          <input
            type="text"
            name="title"
            id="title"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-4 py-3"
            placeholder="Voer de titel in"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="author" className="block text-sm font-medium text-gray-900">
            Auteur
          </label>
          <input
            type="text"
            name="author"
            id="author"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-4 py-3"
            placeholder="Voer de auteur in"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>

        <FileUpload
          accept="image/*"
          label="Omslagafbeelding"
          helpText="Upload een afbeelding voor de omslag"
          onChange={setCoverFile}
          value={coverFile}
        />

        <div>
          <label htmlFor="libraryLink" className="block text-sm font-medium text-gray-900">
            Bibliotheeklink (Optioneel)
          </label>
          <input
            type="url"
            name="libraryLink"
            id="libraryLink"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-4 py-3"
            placeholder="https://..."
            value={libraryLink}
            onChange={(e) => setLibraryLink(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-900">
            Beschrijving (Optioneel)
          </label>
          <textarea
            name="description"
            id="description"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-4 py-3"
            placeholder="Voer een beschrijving in of laat leeg voor automatische generatie"
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-900">
              Recensies
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSearchReviews}
                disabled={isSearchingReviews || isFetchingReviews || !title.trim()}
                className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white ${
                  isSearchingReviews || isFetchingReviews || !title.trim()
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                {isSearchingReviews ? 'Zoeken...' : isFetchingReviews ? 'Recensies Ophalen...' : 'Zoek Recensies'}
              </button>
              <button
                type="button"
                onClick={() => setReviews([...reviews, { text: '' }])}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Handmatig Toevoegen
              </button>
            </div>
          </div>
          
          {reviews.map((review, index) => (
            <div key={index} className="relative p-4 bg-background-paper rounded-lg border border-background-muted">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-grow">
                  {review.title && (
                    <input
                      type="text"
                      value={review.title}
                      onChange={(e) => {
                        const newReviews = [...reviews];
                        newReviews[index] = { ...newReviews[index], title: e.target.value };
                        setReviews(newReviews);
                      }}
                      className="w-full font-medium text-primary bg-transparent border-none p-0 focus:ring-0"
                      placeholder="Review titel"
                    />
                  )}
                  {review.quality !== undefined && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        Kwaliteit: <span className={`font-medium ${review.quality >= 8 ? 'text-green-600' : review.quality >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>{review.quality}/10</span>
                      </span>
                      {review.sourceUrl && (
                        <a 
                          href={review.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-hover hover:underline"
                        >
                          Bekijk origineel
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newReviews = reviews.filter((_, i) => i !== index);
                    setReviews(newReviews.length ? newReviews : [{ text: '' }]);
                  }}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <textarea
                value={review.text}
                onChange={(e) => {
                  const newReviews = [...reviews];
                  newReviews[index] = { ...newReviews[index], text: e.target.value };
                  setReviews(newReviews);
                }}
                rows={3}
                className="w-full text-secondary bg-transparent border-none p-0 focus:ring-0 mt-2"
                placeholder="Review tekst"
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isLoading
              ? 'bg-primary/60 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
          }`}
        >
          {isLoading ? 'Script Genereren...' : 'Podcast Genereren'}
        </button>
      </form>

      {generatedScript && (
        <div className="mt-8 space-y-6">
          <div className="p-6 bg-primary-light rounded-lg border border-background-muted">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-primary">Beschrijving</h2>
            </div>
            <div className="prose max-w-none">
              <textarea
                value={(editedDescription !== null ? editedDescription : generatedDescription) || ''}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full h-32 font-mono text-sm text-primary p-4 rounded-md border border-background-muted focus:border-primary focus:ring-1 focus:ring-primary bg-background-paper"
                placeholder="Boekbeschrijving..."
              />
            </div>
          </div>

          <div className="p-6 bg-primary-light rounded-lg border border-background-muted">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-primary">Script</h2>
              <button
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio}
                className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isGeneratingAudio
                    ? 'bg-primary/60 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
                }`}
              >
                {isGeneratingAudio ? 'Audio Genereren...' : 'Genereer Audio'}
              </button>
            </div>
            <div className="prose max-w-none">
              <textarea
                value={(editedScript !== null ? editedScript : generatedScript) || ''}
                onChange={(e) => setEditedScript(e.target.value)}
                className="w-full h-96 font-mono text-sm text-primary p-4 rounded-md border border-background-muted focus:border-primary focus:ring-1 focus:ring-primary bg-background-paper"
                placeholder="Script text..."
              />
            </div>
          </div>
        </div>
      )}

      {selectedBook && (
        <div className="mb-8">
          <AudioPlayer
            bookKey={selectedBook.audioLink}
            title={selectedBook.title}
            bookId={selectedBook.id}
          />
        </div>
      )}

      {podcasts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">Bestaande Podcasts</h2>
          <ul className="space-y-2">
            {podcasts.map((podcast) => (
              <li 
                key={podcast.id} 
                className="flex flex-col gap-2 p-4 hover:bg-primary-light rounded-lg cursor-pointer border border-background-muted bg-background-paper"
                onClick={() => handlePodcastPlay(podcast)}
              >
                <div className="flex justify-between items-center">
                  <span className="text-primary hover:text-primary-hover transition-colors">
                    {podcast.title}
                  </span>
                  <span className="text-sm text-secondary">
                    {podcast.playCount || 0} keer afgespeeld
                  </span>
                </div>
                <FeedbackBar 
                  positive={podcast.positiveFeedback || 0} 
                  negative={podcast.negativeFeedback || 0} 
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}