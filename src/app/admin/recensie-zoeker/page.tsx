'use client';

import { useState } from 'react';

interface BookSummary {
  content: string;
}

export default function ExperimentalRecensieZoeker() {
  // State management
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BookSummary | null>(null);

  // Function to generate book summary using Perplexity API
  const handleGenerateSummary = async () => {
    if (!title || !author) {
      setError('Please enter both title and author');
      return;
    }

    setIsLoading(true);
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Summary generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-background-DEFAULT rounded-lg shadow">
      <h1 className="text-2xl font-semibold mb-6 text-primary">Experimentele RecensieZoeker</h1>

      {error && (
        <div className="p-4 mb-6 rounded-md bg-error-light text-error border border-error/20">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-900">
            Titel
          </label>
          <input
            type="text"
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
            id="author"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-4 py-3"
            placeholder="Voer de auteur in"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>

        <button
          onClick={handleGenerateSummary}
          disabled={isLoading}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isLoading
              ? 'bg-primary/60 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
          }`}
        >
          {isLoading ? 'Samenvatting Genereren...' : 'Genereer Samenvatting'}
        </button>

        {summary && (
          <div className="mt-8">
            <div className="p-6 bg-primary-light rounded-lg border border-background-muted">
              <div className="prose max-w-none">
                <p className="text-primary whitespace-pre-wrap">{summary.content}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 