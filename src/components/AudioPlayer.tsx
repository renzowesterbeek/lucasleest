'use client';

import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  bookKey: string;
  title: string;
  bookId: string;
}

const BARS_COUNT = 192;

const AudioPlayer = ({ bookKey, title, bookId }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const hasTrackedPlay = useRef<boolean>(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isDurationLoaded, setIsDurationLoaded] = useState(false);
  const [audioData, setAudioData] = useState<number[]>(Array(BARS_COUNT).fill(50));

  // Initialize audio element and set up all event listeners
  useEffect(() => {
    let isActive = true;
    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = 'metadata';

    // Initialize Web Audio API
    const initializeWebAudio = () => {
      if (!audioContextRef.current) {
        try {
          // Safari support
          const AudioContextClass = window.AudioContext || 
            // @ts-expect-error - Safari WebKit AudioContext is not typed in Window interface
            window.webkitAudioContext;

          audioContextRef.current = new AudioContextClass();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 4096;
          analyserRef.current.smoothingTimeConstant = 0.4;
          analyserRef.current.minDecibels = -85;
          analyserRef.current.maxDecibels = -25;

          sourceRef.current = audioContextRef.current.createMediaElementSource(audio);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        } catch (err) {
          console.error('Failed to initialize Web Audio API:', err);
        }
      }
    };

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

    const handleCanPlay = () => {
      if (!audioContextRef.current) {
        initializeWebAudio();
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);

    async function initializeAudio() {
      try {
        setIsLoading(true);
        setIsDurationLoaded(false);
        
        const response = await fetch(`/api/get-signed-url?key=${encodeURIComponent(bookKey)}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to get audio URL');
        }

        if (!isActive) return;

        // Set crossOrigin before setting src
        audio.crossOrigin = 'anonymous';
        audio.src = data.url;

        const checkDuration = () => {
          if (!isNaN(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
            setIsDurationLoaded(true);
            setIsLoading(false);
            return true;
          }
          return false;
        };

        if (!checkDuration()) {
          const loadHandler = () => {
            if (checkDuration()) {
              cleanup();
            }
          };

          const errorHandler = (event: Event) => {
            console.error('Audio loading error:', event);
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
        console.error('Error initializing audio:', err instanceof Error ? err.message : err);
        if (isActive) {
          setError('Error loading audio. Please try again later.');
          setIsLoading(false);
        }
      }
    }

    initializeAudio();

    return () => {
      isActive = false;
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', updateTime);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('canplay', handleCanPlay);
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [bookKey]);

  // Audio visualization effect
  useEffect(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barWidth = Math.floor(bufferLength / BARS_COUNT);

    const updateBars = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average values for each bar with enhanced dynamics
      const newData = Array(BARS_COUNT).fill(0);
      for (let i = 0; i < BARS_COUNT; i++) {
        let sum = 0;
        const startIndex = i * barWidth;
        
        // Weight frequencies differently based on their position
        for (let j = 0; j < barWidth; j++) {
          const value = dataArray[startIndex + j];
          // Apply frequency-dependent scaling
          const scale = 1 + (j / barWidth) * 0.5; // Higher frequencies get boosted
          sum += value * scale;
        }
        
        // Convert to percentage with enhanced dynamics
        const average = sum / barWidth;
        // Apply non-linear scaling for more dramatic effect
        const normalized = Math.pow(average / 255, 1.5) * 100;
        newData[i] = Math.max(normalized, 3);
      }
      
      setAudioData(prev => {
        return newData.map((value, i) => {
          // Responsive smoothing based on value change
          const change = Math.abs(value - (prev[i] || 0));
          const smoothingFactor = isPlaying 
            ? Math.max(0.2, Math.min(0.8, 1 - change / 100)) // Less smoothing for bigger changes
            : 0.8;
          return value * (1 - smoothingFactor) + (prev[i] || 0) * smoothingFactor;
        });
      });
      
      animationRef.current = requestAnimationFrame(updateBars);
    };

    updateBars();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  const trackPlay = async () => {
    if (hasTrackedPlay.current) return;
    
    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'audio_played',
          properties: {
            bookId,
            title
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to track play');
      }

      hasTrackedPlay.current = true;
    } catch (error) {
      console.error('Failed to track play:', error);
    }
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || !isDurationLoaded) return;

    try {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
        await trackPlay();
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      console.error('Playback error:', err instanceof Error ? err.message : err);
      setError('Error playing audio. Please try again.');
    }
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

  // Reset hasTrackedPlay when bookKey changes
  useEffect(() => {
    hasTrackedPlay.current = false;
  }, [bookKey]);

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <p className="text-red-600 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white px-4 py-3">
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlayPause}
          disabled={!isDurationLoaded}
          className={`flex-shrink-0 w-10 h-10 flex items-center justify-center text-white rounded-full focus:outline-none ${
            !isDurationLoaded
              ? 'bg-primary/60 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-hover'
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
          <h2 className="text-sm font-medium text-primary-text-color mb-1">{title}</h2>
          <div className="flex items-center gap-2">
            <div className="flex-grow relative h-12">
              {isLoading || !isDurationLoaded ? (
                <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
                  {Array(BARS_COUNT).fill(0).map((_, index) => (
                    <div
                      key={index}
                      className="w-[1px] bg-background-muted/50 h-[8%] rounded-full"
                    />
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
                  {audioData.map((height, index) => {
                    const barProgress = (index / (BARS_COUNT - 1)) * 100;
                    const isBeforeProgress = barProgress <= progress;
                    
                    // Calculate distance from current progress with a smaller window
                    const distanceFromProgress = Math.abs(barProgress - progress);
                    const isNearProgress = distanceFromProgress < 8;
                    
                    // More dramatic height scaling with audio reactivity
                    const heightMultiplier = isNearProgress 
                      ? Math.pow(Math.cos((distanceFromProgress / 8) * (Math.PI / 2)), 1.5) // Less aggressive falloff
                      : 0.15;
                    
                    // Enhanced scaling for active bars
                    const scaledHeight = height * (isNearProgress ? 2 : 1); // Double the height for active bars
                    
                    return (
                      <div
                        key={index}
                        className={`w-[1px] transition-all duration-50 rounded-full ${
                          isBeforeProgress ? 'bg-primary' : 'bg-background-muted'
                        }`}
                        style={{
                          height: `${Math.max(scaledHeight * heightMultiplier, 8)}%`,
                          opacity: isPlaying ? 1 : 0.7,
                          transform: `scaleY(${isPlaying ? 1 : 0.7})`,
                        }}
                      />
                    );
                  })}
                </div>
              )}
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                disabled={!isDurationLoaded}
                className={`w-full h-full ${!isDurationLoaded ? 'opacity-0 cursor-not-allowed' : 'opacity-0 cursor-pointer'} relative z-10`}
              />
            </div>
            <div className="flex-shrink-0 text-xs text-primary-text-color/60 min-w-[80px] text-right">
              {isLoading || !isDurationLoaded ? (
                "Laden..."
              ) : (
                `${formatTime(currentTime)} / ${formatTime(duration)}`
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AudioPlayer; 