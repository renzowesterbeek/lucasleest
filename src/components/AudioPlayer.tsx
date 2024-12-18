'use client';

import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  bookKey: string;
  title: string;
}

export function AudioPlayer({ bookKey, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isDurationLoaded, setIsDurationLoaded] = useState(false);

  // Initialize audio element and set up all event listeners
  useEffect(() => {
    let isActive = true; // For cleanup
    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = 'metadata';

    // Set up playback event listeners
    const updateTime = () => {
      const current = audio.currentTime;
      const total = audio.duration;
      
      if (!isNaN(current) && !isNaN(total) && total > 0) {
        setCurrentTime(current);
        setProgress((current / total) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration);
      setProgress(100);
    };

    // Add playback event listeners
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);

    async function initializeAudio() {
      try {
        setIsLoading(true);
        setIsDurationLoaded(false);
        
        // Get signed URL
        const response = await fetch(`/api/get-signed-url?key=${encodeURIComponent(bookKey)}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to get audio URL');
        }

        if (!isActive) return; // Don't proceed if component is unmounted

        // Set the audio source
        audio.src = data.url;

        // Try to get duration immediately
        const checkDuration = () => {
          if (!isNaN(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
            setIsDurationLoaded(true);
            setIsLoading(false);
            return true;
          }
          return false;
        };

        // Check duration immediately
        if (!checkDuration()) {
          // If not available immediately, set up event listeners
          const loadHandler = () => {
            if (checkDuration()) {
              cleanup();
            }
          };

          const errorHandler = (e: ErrorEvent) => {
            console.error('Audio loading error:', e);
            setError('Error loading audio. Please try again later.');
            setIsLoading(false);
            cleanup();
          };

          const cleanup = () => {
            audio.removeEventListener('loadedmetadata', loadHandler);
            audio.removeEventListener('durationchange', loadHandler);
            audio.removeEventListener('error', errorHandler);
          };

          audio.addEventListener('loadedmetadata', loadHandler);
          audio.addEventListener('durationchange', loadHandler);
          audio.addEventListener('error', errorHandler);
        }
      } catch (err) {
        console.error('Error initializing audio:', err);
        if (isActive) {
          setError('Error loading audio. Please try again later.');
          setIsLoading(false);
        }
      }
    }

    initializeAudio();

    // Cleanup function
    return () => {
      isActive = false;
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', updateTime);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [bookKey]); // Only re-run when bookKey changes

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !isDurationLoaded) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((error) => {
        console.error('Playback error:', error);
        setError('Error playing audio. Please try again.');
      });
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !isDurationLoaded) return;

    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
    if (duration > 0) {
      setProgress((time / duration) * 100);
    }
  };

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <p className="text-red-600 text-center">{error}</p>
      </div>
    );
  }

  if (isLoading || !isDurationLoaded) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <p className="text-center">Audio laden...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-900">{title}</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        
        <div className="relative pt-1">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #2563eb ${progress}%, #e5e7eb ${progress}%)`
            }}
          />
        </div>
        
        <button
          onClick={togglePlayPause}
          disabled={!isDurationLoaded}
          className={`w-full py-2 px-4 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            !isDurationLoaded
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isPlaying ? 'Pauzeren' : 'Afspelen'}
        </button>
      </div>
    </div>
  );
} 