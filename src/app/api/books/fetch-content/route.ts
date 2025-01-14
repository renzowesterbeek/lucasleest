import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { extract } from '@extractus/article-extractor';
import { Anthropic } from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY
});

// Add SSE helper function
function streamResponse(readable: ReadableStream) {
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function* processUrlsStream(urls: string[], title: string, bookAuthor?: string) {
  let processedCount = 0;

  for (const url of urls) {
    try {
      console.log(`\n[DEBUG] Processing URL: ${url}`);
      const article = await extract(url);
      
      if (!article?.content) {
        console.log('[DEBUG] No content extracted from article');
        yield JSON.stringify({ type: 'progress', url, status: 'skipped', reason: 'no-content' }) + '\n\n';
        continue;
      }

      const cleanContent = article.content
        .replace(/<[^>]+>/g, '')
        .replace(/\n+/g, '\n')
        .replace(/\s+/g, ' ')
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .trim();

      const MAX_CONTENT_LENGTH = 4000;
      const truncatedContent = cleanContent.slice(0, MAX_CONTENT_LENGTH);

      const message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1000,
        temperature: 0,
        system: "Je bent een expert in het analyseren van boekrecensies en samenvattingen. Je communiceert ALLEEN in JSON formaat. Gebruik geen natuurlijke taal in je antwoorden. Wees beknopt.",
        messages: [{
          role: 'user',
          content: `Analyseer de volgende tekst van ${url} over het boek "${title}"${bookAuthor ? ` van ${bookAuthor}` : ''} en retourneer ALLEEN een JSON object met deze structuur:

{
  "quality": number,      // score 1-10 voor kwaliteit en diepgang
  "content": string,     // de schone VOLLEDIGE recensietekst zonder headers/footers/etc
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
- Controleer of de tekst echt over "${title}" gaat${bookAuthor ? ` van ${bookAuthor}` : ''}

Tekst:

${truncatedContent}`
        }]
      });

      const responseText = message.content.find(c => c.type === 'text')?.text;
      if (!responseText) {
        yield JSON.stringify({ type: 'progress', url, status: 'error', reason: 'no-response' }) + '\n\n';
        continue;
      }

      const result = JSON.parse(responseText);
      processedCount++;

      const review = {
        title: article.title || 'Recensie',
        content: result.content,
        url: url,
        quality: result.quality
      };

      yield JSON.stringify({ 
        type: 'review', 
        review,
        processedCount,
        totalUrls: urls.length
      }) + '\n\n';

    } catch (error) {
      console.error(`[DEBUG] Error processing ${url}:`, error);
      yield JSON.stringify({ 
        type: 'progress', 
        url, 
        status: 'error',
        reason: error instanceof Error ? error.message : 'unknown-error'
      }) + '\n\n';
    }
  }
}

export async function POST(req: Request) {
  try {
    const limiter = await rateLimit.check(req, 5, '10 s');
    
    if (!limiter.success) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), { status: 429 });
    }

    const { urls, title, bookAuthor } = await req.json();
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Invalid URLs' }), { status: 400 });
    }

    if (!title) {
      return new NextResponse(JSON.stringify({ error: 'Book title is required' }), { status: 400 });
    }

    if (!ANTHROPIC_API_KEY) {
      console.error('[DEBUG] Missing Claude API key');
      return new NextResponse(JSON.stringify({ error: 'Claude API key not configured' }), { status: 500 });
    }

    // Create a stream of processed reviews
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of processUrlsStream(urls, title, bookAuthor)) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return streamResponse(stream);
  } catch (error) {
    console.error('[DEBUG] Content fetch error:', error);
    return new NextResponse(JSON.stringify({ 
      error: 'Failed to fetch reviews',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500 });
  }
} 