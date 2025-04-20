import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

// Configuration for Brave Search API
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

// Type definitions for Brave Search API responses
interface BraveSearchResult {
  title: string;
  description?: string;
  meta_description?: string;
  url: string;
  language?: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[];
  };
}

/**
 * Cleans HTML tags and entities from text content
 * Used to sanitize search results before processing
 */
function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

export async function POST(req: Request) {
  try {
    // Step 1: Rate limiting to prevent abuse
    const limiter = await rateLimit.check(req, 10, '10 s');
    
    if (!limiter.success) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': limiter.limit.toString(),
          'X-RateLimit-Remaining': limiter.remaining.toString(),
        },
      });
    }

    // Step 2: Validate input parameters
    const { title, author } = await req.json();

    if (!title || typeof title !== 'string') {
      return new NextResponse(JSON.stringify({ error: 'Invalid title' }), {
        status: 400,
      });
    }

    if (!BRAVE_API_KEY) {
      return new NextResponse(JSON.stringify({ error: 'Brave API key not configured' }), {
        status: 500,
      });
    }

    // Step 3: Construct and execute search query
    const searchQuery = `${title} door ${author || ''} boek`;
    console.log('[DEBUG] Search query:', searchQuery);
    const searchUrl = `${BRAVE_SEARCH_URL}?q=${encodeURIComponent(searchQuery)}&language=nl`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
    });

    if (!searchResponse.ok) {
      throw new Error('Failed to fetch from Brave Search');
    }

    // Step 4: Process and filter search results
    const searchData: BraveSearchResponse = await searchResponse.json();
    
    // Extract and format search results
    const searchResults = searchData.web?.results?.slice(0, 15)  // Limit to top 15 results
      .map(result => ({
        title: cleanHtml(result.title || 'Naamloze Recensie'),
        description: cleanHtml(result.description || result.meta_description || ''),
        url: result.url
      }))
      .filter(result => {
        const text = (result.title + ' ' + result.description).toLowerCase();
        const url = result.url.toLowerCase();
        // Exclude bol.com results
        if (url.includes('bol.com')) return false;
        // Check for relevant review-related terms
        return text.includes('recensie') || text.includes('review') || 
               text.includes('gelezen') || text.includes('summary') ||
               text.includes('samenvatting') || text.includes('boek');
      }) || [];

    // Step 5: Return filtered results
    return new NextResponse(JSON.stringify({ searchResults }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Review search error:', error);
    return new NextResponse(JSON.stringify({ error: 'Failed to search for reviews' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 