import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

// Configuration for Perplexity API
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Generates a book summary using Perplexity API
 */
async function generateBookSummary(title: string, author: string) {
  const prompt = `Schrijf een uitgebreide recensie op basis van veel verschilllende recensies van het boek "${title}" van ${author}.
Geef een uitgebreide analyse van het boek, inclusief de belangrijkste thema's, personages en een kwaliteitsbeoordeling.
Zorg dat alle tekst in het Nederlands is en baseer je antwoord op de inhoud van recensies. Het is belangrijk dat je duidelijke bent over wat verschillende mensen vinden van het boek. Schrijf voor de doelgroep van 13-18 jaar. Wees uitgebreid en geef veel details.`;

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'Je bent een expert in het analyseren van boekrecensies en het maken van samenvattingen.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate summary with Perplexity API');
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content
  };
}

export async function POST(req: Request) {
  try {
    // Step 1: Rate limiting (20 requests per minute for Sonar models)
    const limiter = await rateLimit.check(req, 20, '60 s');
    
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

    if (!title || !author) {
      return new NextResponse(JSON.stringify({ error: 'Title and author are required' }), {
        status: 400,
      });
    }

    if (!PERPLEXITY_API_KEY) {
      return new NextResponse(JSON.stringify({ error: 'Perplexity API key not configured' }), {
        status: 500,
      });
    }

    // Step 3: Generate book summary
    const summary = await generateBookSummary(title, author);

    // Step 4: Return results
    return new NextResponse(JSON.stringify(summary), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Summary generation error:', error);
    return new NextResponse(JSON.stringify({ error: 'Failed to generate summary' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 