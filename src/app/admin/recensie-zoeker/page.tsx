'use client';

import { useState } from 'react';

interface SearchResult {
  title: string;
  description: string;
  url: string;
}

interface Review {
  title: string;
  text: string;
  sourceUrl: string;
}

export default function RecensieZoekerPage() {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingContent, setIsFetchingContent] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    setSelectedUrls(new Set());
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

      const data = await response.json();
      setSearchResults(data.searchResults);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch search results');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlToggle = (url: string) => {
    const newSelectedUrls = new Set(selectedUrls);
    if (selectedUrls.has(url)) {
      newSelectedUrls.delete(url);
    } else {
      newSelectedUrls.add(url);
    }
    setSelectedUrls(newSelectedUrls);
  };

  const fetchSelectedContent = async () => {
    setIsFetchingContent(true);
    setError(null);
    const newReviews: Review[] = [];

    try {
      const urlArray = Array.from(selectedUrls);
      const urlToTitle = new Map(searchResults.map(result => [result.url, result.title]));

      for (const url of urlArray) {
        try {
          const response = await fetch('/api/books/fetch-content', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });

          if (response.ok) {
            const data = await response.json();
            newReviews.push({
              title: urlToTitle.get(url) || 'Naamloze Recensie',
              text: data.content,
              sourceUrl: url
            });
          }
        } catch (error) {
          console.error(`Failed to fetch content from ${url}:`, error);
        }
      }

      setReviews(newReviews);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch content');
    } finally {
      setIsFetchingContent(false);
    }
  };

  const updateReview = (index: number, title: string, text: string) => {
    const newReviews = [...reviews];
    newReviews[index] = { ...newReviews[index], title, text };
    setReviews(newReviews);
  };

  const removeReview = (index: number) => {
    const newReviews = reviews.filter((_, i) => i !== index);
    setReviews(newReviews);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-background-DEFAULT rounded-lg shadow">
      <h1 className="text-2xl font-semibold mb-6 text-primary">Recensie Zoeker</h1>

      {error && (
        <div className="p-4 mb-6 rounded-md bg-error-light text-error border border-error/20">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-900 mb-2">
            Boektitel
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-4 py-3"
            placeholder="Voer de boektitel in..."
            required
          />
        </div>

        <div>
          <label htmlFor="author" className="block text-sm font-medium text-gray-900 mb-2">
            Auteur
          </label>
          <input
            type="text"
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-4 py-3"
            placeholder="Voer de auteur in..."
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !title.trim()}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isLoading || !title.trim()
              ? 'bg-primary/60 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
          }`}
        >
          {isLoading ? 'Zoeken...' : 'Zoek Recensies'}
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-primary">Gevonden Recensies</h2>
            <button
              onClick={fetchSelectedContent}
              disabled={selectedUrls.size === 0 || isFetchingContent}
              className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                selectedUrls.size === 0 || isFetchingContent
                  ? 'bg-primary/60 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover'
              }`}
            >
              {isFetchingContent ? 'Inhoud Ophalen...' : 'Haal Geselecteerde Inhoud Op'}
            </button>
          </div>
          <div className="space-y-4">
            {searchResults.map((result, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-background-paper rounded-lg border border-background-muted">
                <input
                  type="checkbox"
                  checked={selectedUrls.has(result.url)}
                  onChange={() => handleUrlToggle(result.url)}
                  className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <div>
                  <h3 className="font-medium text-primary">{result.title}</h3>
                  <p className="text-sm text-secondary mt-1">{result.description}</p>
                  <a 
                    href={result.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-primary-hover hover:underline mt-2 inline-block"
                  >
                    Bekijk origineel
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-primary mb-4">Opgehaalde Recensies</h2>
          {reviews.map((review, index) => (
            <div key={index} className="relative p-4 bg-background-paper rounded-lg border border-background-muted">
              <div className="flex justify-between items-start mb-2">
                <input
                  type="text"
                  value={review.title}
                  onChange={(e) => updateReview(index, e.target.value, review.text)}
                  className="flex-grow font-medium text-primary bg-transparent border-none p-0 focus:ring-0"
                  placeholder="Review titel"
                />
                <a 
                  href={review.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-hover hover:underline ml-2 shrink-0"
                >
                  Bekijk origineel
                </a>
              </div>
              <textarea
                value={review.text}
                onChange={(e) => updateReview(index, review.title, e.target.value)}
                rows={3}
                className="w-full text-secondary bg-transparent border-none p-0 focus:ring-0"
                placeholder="Review tekst"
              />
              <button
                onClick={() => removeReview(index)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {!isLoading && searchResults.length === 0 && (
        <p className="text-secondary">Geen recensies gevonden. Probeer een andere zoekopdracht.</p>
      )}
    </div>
  );
} 