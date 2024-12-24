import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface ScriptRequest {
  title: string;
  author: string;
  libraryLink?: string;
  coverImage: string;
  reviews: string[];
}

// Function to read dialog prompt with error handling
function readDialogPrompt(): string {
  try {
    // First try to read from the frontend directory
    const frontendPath = path.join(process.cwd(), 'frontend', 'dialog_prompt.txt');
    if (fs.existsSync(frontendPath)) {
      console.log('Reading dialog prompt from frontend directory');
      return fs.readFileSync(frontendPath, 'utf-8');
    }

    // If not found, try root directory
    const rootPath = path.join(process.cwd(), 'dialog_prompt.txt');
    if (fs.existsSync(rootPath)) {
      console.log('Reading dialog prompt from root directory');
      return fs.readFileSync(rootPath, 'utf-8');
    }

    throw new Error('Dialog prompt file not found');
  } catch (error) {
    console.error('Error reading dialog prompt:', error);
    throw new Error('Failed to read dialog prompt file');
  }
}

// Function to generate a book description using Claude Haiku
async function generateBookDescription(title: string, author: string, reviews: string[]): Promise<string> {
  const combinedReviews = reviews
    .filter(review => review.trim())
    .join('\n\n');

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 1000,
    temperature: 0,
    system: "Introduceer de beschrijving niet, noem alleen de beschrijving zelf. Behandel de belangrijkste thema's, personages en plot en benoem belangrijke steekwoorden in de beschrijving voor SEO. Vermeid de volgende steekwoorden: 'young adult', 'jeugdboek'",
    messages: [
      {
        role: 'user',
        content: `Schrijf een beknopte beschrijving van ongeveer 100 woorden van het boek '${title}' van ${author}, gebaseerd op deze teksten:\n\n${combinedReviews}.`
      }
    ]
  });

  const content = message.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('No description generated by AI');
  }

  return content.text;
}

export async function POST(request: Request) {
  try {
    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Read request body
    const body: ScriptRequest = await request.json();
    const { title, author, reviews } = body;

    // Validate request data
    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!author?.trim()) {
      return NextResponse.json(
        { error: 'Author is required' },
        { status: 400 }
      );
    }

    if (!reviews || reviews.length === 0 || !reviews.some(review => review.trim())) {
      return NextResponse.json(
        { error: 'At least one non-empty review is required' },
        { status: 400 }
      );
    }

    // Read dialog prompt
    let dialogPrompt: string;
    try {
      dialogPrompt = readDialogPrompt();
    } catch (error) {
      console.error('Failed to read dialog prompt:', error);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Generate a description using Claude Haiku
    const bookDescription = await generateBookDescription(title, author, reviews);

    // Combine all reviews into one text, filtering out empty ones
    const combinedReviews = reviews
      .filter(review => review.trim())
      .join('\n\n');

    // Generate the podcast script using Claude Sonnet
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 5000,
      temperature: 0.4,
      system: dialogPrompt,
      messages: [
        {
          role: 'user',
          content: `Schrijf een script voor een podcast over het boek '${title}' van ${author}, gebaseerd op de volgende teksten:\n\n${combinedReviews}`
        }
      ]
    });

    const content = message.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('No script generated by AI');
    }

    return NextResponse.json({
      success: true,
      script: content.text,
      description: bookDescription
    });

  } catch (error) {
    console.error('Error generating script:', error);
    
    // Handle specific error types
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: 'AI service temporarily unavailable' },
        { status: 503 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Failed to generate script' },
      { status: 500 }
    );
  }
} 