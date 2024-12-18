'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  accept: string;
  label: string;
  helpText: string;
  onChange: (file: File) => void;
  value?: File;
}

export function FileUpload({ accept, label, helpText, onChange, value }: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onChange(acceptedFiles[0]);
    }
  }, [onChange]);

  const { getRootProps, getInputProps, isDragReject } = useDropzone({
    onDrop,
    accept: { [accept]: [] },
    maxFiles: 1,
    multiple: false,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
      </label>
      <div
        {...getRootProps()}
        className={`mt-1 flex justify-center rounded-lg border border-dashed px-6 py-8 transition-colors
          ${isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}
          ${isDragReject ? 'border-red-400 bg-red-50' : ''}
        `}
      >
        <div className="text-center">
          <input {...getInputProps()} />
          {value ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="mt-4 text-sm font-medium text-gray-900">
                {value.name}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Klik of sleep om een ander bestand te kiezen
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div className="mt-4 flex text-sm leading-6 text-gray-600">
                <span className="relative rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                  Upload een bestand
                </span>
                <p className="pl-1">of sleep het hierheen</p>
              </div>
              <p className="text-xs leading-5 text-gray-600">{helpText}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 