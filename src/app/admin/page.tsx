'use client';

import { useState, useRef } from 'react';
import { BookInput } from '@/types/book';
import { FileUpload } from '@/components/FileUpload';

export default function AdminPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ audio: 0, transcript: 0, cover: 0 });
  const [audioFile, setAudioFile] = useState<File>();
  const [transcriptFile, setTranscriptFile] = useState<File>();
  const [coverFile, setCoverFile] = useState<File>();
  const formRef = useRef<HTMLFormElement>(null);

  const uploadFile = async (file: File, type: 'audio' | 'transcript' | 'cover'): Promise<string> => {
    // Get pre-signed URL
    const uploadUrlResponse = await fetch('/api/get-upload-url?filename=' + encodeURIComponent(file.name) + '&type=' + type);
    if (!uploadUrlResponse.ok) {
      const error = await uploadUrlResponse.json();
      throw new Error(error.error || 'Failed to get upload URL');
    }
    
    const { url: uploadUrl, key } = await uploadUrlResponse.json();

    // Upload the file with progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      
      // Set the correct content type based on file type
      let contentType = file.type; // Use the file's native content type if available
      if (!contentType) {
        // Fallback content types if not available from the file
        switch (type) {
          case 'audio':
            contentType = 'audio/mpeg';
            break;
          case 'transcript':
            contentType = 'text/plain';
            break;
          case 'cover':
            contentType = 'image/jpeg'; // Default to JPEG if no type available
            break;
        }
      }
      xhr.setRequestHeader('Content-Type', contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setUploadProgress(prev => ({
            ...prev,
            [type]: percentComplete
          }));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error(`Upload failed for ${type} file`));
        }
      };
      xhr.onerror = () => reject(new Error(`Upload failed for ${type} file`));
      xhr.send(file);
    });

    return key;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    setMessage(null);
    setUploadProgress({ audio: 0, transcript: 0, cover: 0 });

    try {
      const formData = new FormData(e.currentTarget);
      
      if (!audioFile) {
        throw new Error('Please select an audio file');
      }
      if (!transcriptFile) {
        throw new Error('Please select a transcript file');
      }
      if (!coverFile) {
        throw new Error('Please select a cover image');
      }

      setMessage({ type: 'success', text: 'Uploading files...' });

      // Upload all files
      const [audioKey, transcriptKey, coverKey] = await Promise.all([
        uploadFile(audioFile, 'audio'),
        uploadFile(transcriptFile, 'transcript'),
        uploadFile(coverFile, 'cover')
      ]);

      setMessage({ type: 'success', text: 'Files uploaded, creating book record...' });

      // Create the book record in DynamoDB
      const bookData: BookInput = {
        title: formData.get('title') as string,
        author: formData.get('author') as string,
        description: formData.get('description') as string,
        audioLink: audioKey,
        audioTranscript: transcriptKey,
        coverImage: coverKey,
        libraryLink: formData.get('libraryLink') as string || undefined,
      };

      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create book record');
      }

      setMessage({ type: 'success', text: 'Book uploaded successfully!' });
      formRef.current?.reset();
      setUploadProgress({ audio: 0, transcript: 0, cover: 0 });
      setAudioFile(undefined);
      setTranscriptFile(undefined);
      setCoverFile(undefined);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to upload book' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const totalProgress = (uploadProgress.audio + uploadProgress.transcript + uploadProgress.cover) / 3;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-semibold mb-6 text-indigo-600">Nieuw Boek Toevoegen</h1>

      {message && (
        <div className={`p-4 mb-6 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-900 border border-green-200' 
            : 'bg-red-100 text-red-900 border border-red-200'
        }`}>
          {message.type === 'success' 
            ? message.text.replace('Book uploaded successfully!', 'Boek succesvol geüpload!')
              .replace('Uploading files...', 'Bestanden uploaden...')
              .replace('Files uploaded, creating book record...', 'Bestanden geüpload, boekgegevens worden opgeslagen...')
            : message.text.replace('Failed to upload book', 'Uploaden van boek mislukt')
              .replace('Please select an audio file', 'Selecteer een audiobestand')
              .replace('Please select a transcript file', 'Selecteer een transcriptbestand')
              .replace('Please select a cover image', 'Selecteer een omslagafbeelding')
          }
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
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-900">
            Beschrijving
          </label>
          <textarea
            name="description"
            id="description"
            required
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-4 py-3"
            placeholder="Voer een beschrijving in"
          />
        </div>

        <FileUpload
          accept="audio/mpeg"
          label="Audiobestand (MP3)"
          helpText="Alleen MP3-bestanden zijn toegestaan"
          onChange={setAudioFile}
          value={audioFile}
        />

        <FileUpload
          accept="text/plain"
          label="Transcriptbestand (TXT)"
          helpText="Alleen tekstbestanden zijn toegestaan"
          onChange={setTranscriptFile}
          value={transcriptFile}
        />

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
          />
        </div>

        {(uploadProgress.audio > 0 || uploadProgress.transcript > 0 || uploadProgress.cover > 0) && (
          <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  Voortgang Audio Upload
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round(uploadProgress.audio)}%
                </span>
              </div>
              <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                <div
                  style={{ width: `${uploadProgress.audio}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-300"
                />
              </div>
            </div>

            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  Voortgang Transcript Upload
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round(uploadProgress.transcript)}%
                </span>
              </div>
              <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                <div
                  style={{ width: `${uploadProgress.transcript}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-300"
                />
              </div>
            </div>

            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  Voortgang Omslag Upload
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round(uploadProgress.cover)}%
                </span>
              </div>
              <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                <div
                  style={{ width: `${uploadProgress.cover}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-300"
                />
              </div>
            </div>

            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  Totale Voortgang
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round(totalProgress)}%
                </span>
              </div>
              <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                <div
                  style={{ width: `${totalProgress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-300"
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isUploading
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }`}
        >
          {isUploading ? 'Bezig met uploaden...' : 'Boek Uploaden'}
        </button>
      </form>
    </div>
  );
} 