'use client';

import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  bookKey: string;
  title: string;
}

const AudioPlayer = ({ bookKey, title }: AudioPlayerProps) => {
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
    <div className="w-full bg-white px-4 py-3">
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlayPause}
          disabled={!isDurationLoaded}
          className={`flex-shrink-0 w-10 h-10 flex items-center justify-center text-white rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            !isDurationLoaded
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          aria-label={isPlaying ? 'Pauzeren' : 'Afspelen'}
        >
          {isPlaying ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          ) : (
            <svg className="h-5 w-5 ml-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
            </svg>
          )}
        </button>

        <div className="flex-grow">
          <h2 className="text-sm font-medium text-gray-900 mb-1">{title}</h2>
          <div className="flex items-center gap-2">
            <div className="flex-grow relative">
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
            <div className="flex-shrink-0 text-xs text-gray-500 min-w-[80px] text-right">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AudioPlayer; 