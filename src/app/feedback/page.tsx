'use client';

import { useState } from 'react';

interface FeedbackFormData {
  name: string;
  email: string;
  type: 'feedback' | 'book_suggestion' | 'other';
  message: string;
  bookTitle?: string;
  bookAuthor?: string;
}

export default function FeedbackPage() {
  const [formData, setFormData] = useState<FeedbackFormData>({
    name: '',
    email: '',
    type: 'feedback',
    message: '',
    bookTitle: '',
    bookAuthor: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string | null;
  }>({ type: null, message: null });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: null });

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitStatus({
          type: 'success',
          message: 'Bedankt voor je bericht! We nemen het zo snel mogelijk in behandeling.',
        });
        // Reset form
        setFormData({
          name: '',
          email: '',
          type: 'feedback',
          message: '',
          bookTitle: '',
          bookAuthor: '',
        });
      } else {
        throw new Error('Er is iets misgegaan bij het versturen van je bericht.');
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Er is iets misgegaan.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-[#f2f0e9]">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-background-paper shadow-lg rounded-xl overflow-hidden border border-background-muted">
          <div className="px-8 pt-8">
            <h1 className="text-2xl font-semibold text-primary-text-color mb-2">
              Feedback & Suggesties
            </h1>
            <p className="text-primary-text-color/80 mb-6">
              We horen graag van je! Laat ons weten wat je van Lucas Leest vindt of suggereer een boek 
              dat je graag besproken zou zien worden.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-primary-text-color">
                Soort Bericht
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-xl border-background-muted shadow-sm focus:border-primary focus:ring-1 focus:ring-primary bg-background-paper px-4 py-3 text-primary-text-color"
                required
              >
                <option value="feedback">Feedback</option>
                <option value="book_suggestion">Boeksuggestie</option>
                <option value="other">Anders</option>
              </select>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-primary-text-color">
                Naam
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-xl border-background-muted shadow-sm focus:border-primary focus:ring-1 focus:ring-primary bg-background-paper px-4 py-3 text-primary-text-color"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-primary-text-color">
                E-mail
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-xl border-background-muted shadow-sm focus:border-primary focus:ring-1 focus:ring-primary bg-background-paper px-4 py-3 text-primary-text-color"
                required
              />
            </div>

            {formData.type === 'book_suggestion' && (
              <>
                <div>
                  <label htmlFor="bookTitle" className="block text-sm font-medium text-primary-text-color">
                    Boektitel
                  </label>
                  <input
                    type="text"
                    id="bookTitle"
                    name="bookTitle"
                    value={formData.bookTitle}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-xl border-background-muted shadow-sm focus:border-primary focus:ring-1 focus:ring-primary bg-background-paper px-4 py-3 text-primary-text-color"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="bookAuthor" className="block text-sm font-medium text-primary-text-color">
                    Auteur
                  </label>
                  <input
                    type="text"
                    id="bookAuthor"
                    name="bookAuthor"
                    value={formData.bookAuthor}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-xl border-background-muted shadow-sm focus:border-primary focus:ring-1 focus:ring-primary bg-background-paper px-4 py-3 text-primary-text-color"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-primary-text-color">
                Bericht
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={formData.message}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-xl border-background-muted shadow-sm focus:border-primary focus:ring-1 focus:ring-primary bg-background-paper px-4 py-3 text-primary-text-color"
                required
              />
            </div>

            {submitStatus.message && (
              <div
                className={`p-4 rounded-xl ${
                  submitStatus.type === 'success'
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-error/10 text-error border border-error/20'
                }`}
              >
                {submitStatus.message}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white ${
                  isSubmitting
                    ? 'bg-primary/60 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
                }`}
              >
                {isSubmitting ? 'Versturen...' : 'Verstuur'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 