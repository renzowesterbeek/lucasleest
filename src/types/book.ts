export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  audioLink: string;
  audioTranscript: string;
  libraryLink?: string;
  coverImage?: string;
  createdAt: string;
  playCount?: number;
  positiveFeedback?: number;
  negativeFeedback?: number;
}

export interface BookInput {
  title: string;
  author: string;
  description: string;
  audioLink: string;
  audioTranscript: string;
  libraryLink?: string;
  coverImage?: string;
} 