import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { extract } from '@extractus/article-extractor';
import Anthropic from '@anthropic-ai/sdk';

// Configuration for Claude AI
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY
});

// Type definitions for review analysis results
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

/**
 * Analyzes and extracts reviews from a list of URLs
 * Uses Claude AI to evaluate content quality and relevance
 */
async function analyzeAndExtractReviews(urls: string[], bookTitle: string, bookAuthor?: string): Promise<ReviewResult[]> {
  const analyzedReviews: AnalyzedReview[] = [];

  for (const url of urls) {
    try {
      // Step 1: Extract content from URL using article-extractor
      console.log(`\n[DEBUG] Processing URL: ${url}`);
      const article = await extract(url);
      
      if (!article?.content) {
        console.log('[DEBUG] No content extracted from article');
        continue;
      }

      console.log(`[DEBUG] Article title: ${article.title}`);
      console.log(`[DEBUG] Raw content length: ${article.content.length} characters`);

      // Step 2: Clean and normalize the extracted content
      const cleanContent = article.content
        .replace(/<[^>]+>/g, '')  // Remove HTML tags
        .replace(/\n+/g, '\n')    // Normalize newlines
        .replace(/\s+/g, ' ')     // Normalize whitespace
        .trim();

      console.log(`[DEBUG] Cleaned content length: ${cleanContent.length} characters`);
      console.log('[DEBUG] First 200 chars of cleaned content:', cleanContent.substring(0, 200));

      // Step 3: Use Claude AI to analyze the review content
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
        // Step 4: Process Claude's response
        const responseText = message.content.find(c => c.type === 'text')?.text;
        if (!responseText) {
          console.log('[DEBUG] No text content in Claude response');
          continue;
        }

        // Parse the JSON response from Claude
        const analysis = JSON.parse(responseText);
        
        // Step 5: Add the analyzed review to results if it meets quality criteria
        if (analysis.quality >= 6) {  // Only include reviews with quality score >= 6
          analyzedReviews.push({
            title: article.title || 'Naamloze Recensie',
            content: analysis.content,
            url,
            quality: analysis.quality
          });
        }
      } catch (parseError) {
        console.error('[DEBUG] Failed to parse Claude response:', parseError);
        continue;
      }
    } catch (error) {
      console.error(`[DEBUG] Error processing URL ${url}:`, error);
      continue;
    }
  }

  // Step 6: Sort reviews by quality and return top results
  return analyzedReviews
    .sort((a, b) => b.quality - a.quality)
    .slice(0, 5);  // Return top 5 highest quality reviews
}

export async function POST(req: Request) {
  try {
    // Step 1: Rate limiting
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

    // Step 2: Validate input parameters
    const { urls, title, author } = await req.json();

    if (!urls?.length || !title) {
      return new NextResponse(JSON.stringify({ error: 'Invalid parameters' }), {
        status: 400,
      });
    }

    // Step 3: Analyze and extract reviews
    const reviews = await analyzeAndExtractReviews(urls, title, author);

    // Step 4: Return results
    return new NextResponse(JSON.stringify({ reviews }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Content extraction error:', error);
    return new NextResponse(JSON.stringify({ error: 'Failed to extract content' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 