import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { extract } from '@extractus/article-extractor';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY
});

interface ReviewResult {
  title: string;
  content: string;
  url: string;
  quality: number;
}

interface AnalyzedReview {
  title: string;
  content: string;
  url: string;
  quality: number;
}

async function analyzeAndExtractReviews(urls: string[], bookTitle: string, bookAuthor?: string): Promise<ReviewResult[]> {
  const analyzedReviews: AnalyzedReview[] = [];

  for (const url of urls) {
    try {
      // Extract content from URL
      console.log(`\n[DEBUG] Processing URL: ${url}`);
      const article = await extract(url);
      
      if (!article?.content) {
        console.log('[DEBUG] No content extracted from article');
        continue;
      }

      console.log(`[DEBUG] Article title: ${article.title}`);
      console.log(`[DEBUG] Raw content length: ${article.content.length} characters`);

      // Clean up HTML and normalize whitespace
      const cleanContent = article.content
        .replace(/<[^>]+>/g, '')
        .replace(/\n+/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();

      console.log(`[DEBUG] Cleaned content length: ${cleanContent.length} characters`);
      console.log('[DEBUG] First 200 chars of cleaned content:', cleanContent.substring(0, 200));

      // Use Claude to analyze and extract the review
      console.log('[DEBUG] Sending request to Claude...');
      
      const message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 2000,
        system: "Je bent een expert in het analyseren van boekrecensies en samenvattingen. Je communiceert ALLEEN in JSON formaat. Gebruik geen natuurlijke taal in je antwoorden.",
        messages: [{
          role: 'user',
          content: `Analyseer de volgende tekst van ${url} over het boek "${bookTitle}"${bookAuthor ? ` van ${bookAuthor}` : ''} en retourneer ALLEEN een JSON object met deze structuur:

{
  "quality": number,      // score 1-10 voor kwaliteit en diepgang
  "content": string,      // de schone VOLLEDIGE recensietekst zonder headers/footers/etc
  "reason": string       // korte uitleg over de kwaliteit van de tekst
}

POSTIEVE invloed op score:
- Geef alleen een hoge quality score (8-10) aan diepgaande, goed geschreven teksten
- Behandelt belangrijke thema's in het boek
- Behandelt belangrijke personages in het boek
- Veel details over het boek of schrijver
- Bevat een persoonlijke mening van de schrijver van de tekst
- Geschreven in volle zinnen en natuurlijke taal
- Uitgebreide, lange tekst

NEGATIEVE invloed op score:
- Slecht geschreven tekst
- Gaat over een ander boek of onderwerp
- Geef een lage score (1-4) aan korte of oppervlakkige teksten
- Teksten met minder dan 600 karakters krijgen DIRECT een score van 1

BELANGRIJK:
- Retourneer ALLEEN het JSON object, geen andere tekst
- Verwijder alle navigatie, headers, footers en advertenties uit de content
- Doe geen enkele aanpassing aan de content
- Vertaal de content zo nodig naar het Nederlands
- Controleer of de tekst echt over "${bookTitle}" gaat${bookAuthor ? ` van ${bookAuthor}` : ''}

Tekst:

${cleanContent}`
        }]
      });

      try {
        // Get the text content from the message
        const responseText = message.content.find(c => c.type === 'text')?.text;
        if (!responseText) {
          console.error('[DEBUG] No text content found in Claude response');
          continue;
        }

        const result = JSON.parse(responseText);
        console.log('[DEBUG] Parsed result:', JSON.stringify(result, null, 2));

        console.log('[DEBUG] Adding content with quality score:', result.quality);
        analyzedReviews.push({
          title: article.title || 'Recensie',
          content: result.content,
          url: url,
          quality: result.quality
        });
      } catch (parseError) {
        console.error('[DEBUG] Failed to parse Claude response as JSON:', parseError);
        // Get the text content again for error logging
        const errorText = message.content.find(c => c.type === 'text')?.text;
        console.log('[DEBUG] Raw text that failed to parse:', errorText);
      }
    } catch (error) {
      console.error(`[DEBUG] Error processing ${url}:`, error);
      continue;
    }
  }

  // Sort reviews by quality
  analyzedReviews.sort((a, b) => b.quality - a.quality);

  // Start with high quality threshold
  let qualityThreshold = 6;
  let selectedReviews = analyzedReviews.filter(r => r.quality >= qualityThreshold);

  // Lower threshold until we have at least 4 reviews or can't lower anymore
  while (selectedReviews.length < 4 && qualityThreshold > 1) {
    qualityThreshold--;
    console.log(`[DEBUG] Lowering quality threshold to ${qualityThreshold} to get more reviews`);
    selectedReviews = analyzedReviews.filter(r => r.quality >= qualityThreshold);
  }

  console.log(`[DEBUG] Final quality threshold: ${qualityThreshold}`);
  console.log(`[DEBUG] Total reviews found: ${selectedReviews.length}`);

  // Map to final format and return top 5
  return selectedReviews.slice(0, 5).map(r => ({
    title: r.title,
    content: r.content,
    url: r.url,
    quality: r.quality
  }));
}

export async function POST(req: Request) {
  try {
    // Rate limiting
    const limiter = await rateLimit.check(req, 5, '10 s');
    
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

    const { urls, title, author } = await req.json();
    console.log('[DEBUG] Received URLs:', urls);
    console.log('[DEBUG] Book title:', title);
    console.log('[DEBUG] Book author:', author);

    if (!Array.isArray(urls) || urls.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Invalid URLs' }), {
        status: 400,
      });
    }

    if (!title) {
      return new NextResponse(JSON.stringify({ error: 'Book title is required' }), {
        status: 400,
      });
    }

    if (!ANTHROPIC_API_KEY) {
      console.error('[DEBUG] Missing Claude API key');
      return new NextResponse(JSON.stringify({ error: 'Claude API key not configured' }), {
        status: 500,
      });
    }

    // Process all URLs and get the best reviews
    const reviews = await analyzeAndExtractReviews(urls, title, author);
    console.log('[DEBUG] Returning reviews:', JSON.stringify(reviews, null, 2));

    return new NextResponse(JSON.stringify({ reviews }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[DEBUG] Content fetch error:', error);
    return new NextResponse(JSON.stringify({ 
      reviews: []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 