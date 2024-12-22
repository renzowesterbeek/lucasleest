'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileUpload } from '@/components/FileUpload';
import dynamic from 'next/dynamic';

// Dynamically import AudioPlayer with no SSR
const AudioPlayer = dynamic(
  () => import('@/components/AudioPlayer').then((mod) => mod.default),
  { ssr: false }
);

interface Review {
  text: string;
}

async function fetchDescriptionText(url: string): Promise<string> {
  try {
    const response = await fetch(`https://${process.env.NEXT_PUBLIC_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_REGION}.amazonaws.com/${url}`);
    if (!response.ok) {
      throw new Error('Failed to fetch description');
    }
    return await response.text();
  } catch (error) {
    console.error('Error fetching description:', error);
    return '';
  }
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

const FeedbackBar = ({ positive = 0, negative = 0 }: { positive: number; negative: number }) => {
  const total = positive + negative;
  const positivePercentage = total > 0 ? (positive / total) * 100 : 0;
  const hasNoFeedback = total === 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-grow h-2 rounded-full overflow-hidden bg-[#dad5dd]">
        {hasNoFeedback ? (
          <div className="h-full w-full bg-[#dad5dd]" />
        ) : (
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
        )}
      </div>
      <div className="flex gap-3 text-sm font-medium min-w-[80px] justify-end">
        <span className={`flex items-center gap-1 ${hasNoFeedback ? 'text-[#dad5dd]' : 'text-green-600'}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          {positive}
        </span>
        <span className={`flex items-center gap-1 ${hasNoFeedback ? 'text-[#dad5dd]' : 'text-red-600'}`}>
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
  const [coverImage, setCoverImage] = useState('');
  const [reviews, setReviews] = useState<Review[]>([{ text: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [selectedBook, setSelectedBook] = useState<Podcast | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [editedScript, setEditedScript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [coverFile, setCoverFile] = useState<File>();
  const [currentPodcastId, setCurrentPodcastId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setGeneratedScript(null);
    setIsLoading(true);

    try {
      if (!coverFile) {
        throw new Error('Please select a cover image');
      }

      const formData = new FormData(e.currentTarget);
      
      const podcastData = {
        title: formData.get('title') as string,
        author: formData.get('author') as string,
        libraryLink: formData.get('libraryLink') as string || undefined,
        reviews: reviews.filter(review => review.text.trim() !== '').map(review => review.text),
      };

      // First upload the cover image
      const uploadUrlResponse = await fetch('/api/get-upload-url?filename=' + encodeURIComponent(coverFile.name) + '&type=cover');
      if (!uploadUrlResponse.ok) {
        const error = await uploadUrlResponse.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }
      
      const { url: uploadUrl, key: coverKey } = await uploadUrlResponse.json();

      // Upload the cover file
      await fetch(uploadUrl, {
        method: 'PUT',
        body: coverFile,
        headers: {
          'Content-Type': coverFile.type,
        },
      });

      // Now create the podcast script
      const response = await fetch('/api/podcasts/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...podcastData,
          coverImage: coverKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create podcast');
      }

      setGeneratedScript(data.script);
      setCurrentPodcastId(data.id);
      setSuccessMessage('Script succesvol gegenereerd!');
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create podcast');
    } finally {
      setIsLoading(false);
    }
  };

  const addReview = () => {
    setReviews([...reviews, { text: '' }]);
  };

  const updateReview = (index: number, text: string) => {
    const newReviews = [...reviews];
    newReviews[index] = { text };
    setReviews(newReviews);
  };

  const removeReview = (index: number) => {
    if (reviews.length > 1) {
      const newReviews = reviews.filter((_, i) => i !== index);
      setReviews(newReviews);
    }
  };

  const handleGenerateAudio = async () => {
    if (!currentPodcastId) {
      setError('No podcast ID available');
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
          title: title,
          script: editedScript || generatedScript
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start audio generation');
      }

      setSuccessMessage('Audio generatie is gestart op de achtergrond. Dit kan enkele minuten duren.');
    } catch (error) {
      console.error('Audio generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start audio generation');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Simplified fetch podcasts function
  const fetchPodcasts = async () => {
    try {
      const response = await fetch('/api/podcasts/script');
      if (!response.ok) {
        throw new Error('Failed to fetch podcasts');
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch podcasts');
      }

      // Ensure all podcasts have the required fields with defaults
      const processedPodcasts = data.podcasts.map((podcast: Podcast) => ({
        ...podcast,
        playCount: podcast.playCount || 0,
        positiveFeedback: podcast.positiveFeedback || 0,
        negativeFeedback: podcast.negativeFeedback || 0,
      }));

      setPodcasts(processedPodcasts);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to fetch podcasts');
    }
  };

  useEffect(() => {
    fetchPodcasts();
  }, []);

  const handlePodcastPlay = async (podcast: Podcast) => {
    // Reset audio player by clearing and re-setting the book
    setSelectedBook(null);
    setTimeout(() => setSelectedBook(podcast), 0);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-[#edece4] rounded-lg shadow">
      <h1 className="text-2xl font-semibold mb-6 text-[#cc7c5e]">Nieuwe Podcast Creëren</h1>

      {error && (
        <div className="p-4 mb-6 rounded-md bg-red-50 text-red-900 border border-red-200">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 mb-6 rounded-md bg-[#f2f0e9] text-[#cc7c5e] border border-[#cc7c5e]/20">
          {successMessage}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
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

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-900">
              Recensies
            </label>
            <button
              type="button"
              onClick={addReview}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Recensie Toevoegen
            </button>
          </div>
          
          {reviews.map((review, index) => (
            <div key={index} className="relative">
              <textarea
                value={review.text}
                onChange={(e) => updateReview(index, e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-4 py-3"
                placeholder="Voer de review tekst in"
              />
              {reviews.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeReview(index)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isLoading
              ? 'bg-[#cc7c5e]/60 cursor-not-allowed'
              : 'bg-[#cc7c5e] hover:bg-[#b56a50] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#cc7c5e]'
          }`}
        >
          {isLoading ? 'Script Genereren...' : 'Podcast Genereren'}
        </button>
      </form>

      {generatedScript && (
        <div className="mt-8 p-6 bg-[#f2f0e9] rounded-lg border border-[#dad5dd]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-[#cc7c5e]">Script</h2>
            <button
              onClick={handleGenerateAudio}
              disabled={isGeneratingAudio}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isGeneratingAudio
                  ? 'bg-[#cc7c5e]/60 cursor-not-allowed'
                  : 'bg-[#cc7c5e] hover:bg-[#b56a50] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#cc7c5e]'
              }`}
            >
              {isGeneratingAudio ? 'Audio Genereren...' : 'Genereer Audio'}
            </button>
          </div>
          <div className="prose max-w-none">
            <textarea
              value={editedScript !== null ? editedScript : generatedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              className="w-full h-96 font-mono text-sm text-[#cc7c5e] p-4 rounded-md border border-[#dad5dd] focus:border-[#cc7c5e] focus:ring-1 focus:ring-[#cc7c5e] bg-white"
              placeholder="Script text..."
            />
          </div>
        </div>
      )}

      {selectedBook && (
        <div className="mb-8">
          <AudioPlayer
            bookKey={selectedBook.audioLink}
            title={selectedBook.title}
          />
        </div>
      )}

      {podcasts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-[#cc7c5e]">Bestaande Podcasts</h2>
          <ul className="space-y-2">
            {podcasts.map((podcast) => (
              <li 
                key={podcast.id} 
                className="flex flex-col gap-2 p-4 hover:bg-[#f2f0e9] rounded-lg cursor-pointer border border-[#dad5dd] bg-white"
                onClick={() => handlePodcastPlay(podcast)}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[#cc7c5e] hover:text-[#b56a50] transition-colors">
                    {podcast.title}
                  </span>
                  <span className="text-sm text-[#897dc9]">
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