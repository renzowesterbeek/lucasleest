import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

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

// Function to clean up HTML tags and entities
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
    // Get API key inside the function
    const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

    // Debug environment variables (without exposing sensitive data)
    console.log('[DEBUG] Environment check:', {
      hasBraveKey: !!BRAVE_API_KEY,
      nodeEnv: process.env.NODE_ENV
    });

    // Rate limiting
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

    const { title, author } = await req.json();

    if (!title || typeof title !== 'string') {
      return new NextResponse(JSON.stringify({ error: 'Invalid title' }), {
        status: 400,
      });
    }

    if (!BRAVE_API_KEY) {
      return new NextResponse(JSON.stringify({ 
        error: 'Brave API key not configured',
        debug: {
          nodeEnv: process.env.NODE_ENV,
          hasKey: !!process.env.BRAVE_API_KEY
        }
      }), {
        status: 500,
      });
    }

    // Search for Dutch book reviews
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
      const errorText = await searchResponse.text();
      console.error('[DEBUG] Search API error:', {
        status: searchResponse.status,
        statusText: searchResponse.statusText,
        response: errorText
      });
      throw new Error(`Failed to fetch from Brave Search: ${searchResponse.status} - ${errorText}`);
    }

    const searchData: BraveSearchResponse = await searchResponse.json();
    console.log('[DEBUG] Search results count:', searchData.web?.results?.length || 0);
    
    // Extract and format search results
    const searchResults = searchData.web?.results?.slice(0, 15)
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

    console.log('[DEBUG] Filtered results count:', searchResults.length);

    return new NextResponse(JSON.stringify({ searchResults }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[DEBUG] Search error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    return new NextResponse(JSON.stringify({ error: 'Failed to search for reviews' }), {
      status: 500,
    });
  }
} 