import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// Use the same table name as the books endpoint
const DYNAMODB_TABLE_NAME = 'LucasLeestBooks';

interface ScriptRequest {
  title: string;
  author: string;
  libraryLink?: string;
  coverImage: string;
  reviews: string[];
}

interface PodcastData {
  id: string;
  title: string;
  author: string;
  libraryLink?: string;
  coverImage: string;
  description: string;
  audioTranscript: string;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

// Function to read dialog prompt with error handling
function readDialogPrompt(): string {
  try {
    // First try to read from the frontend directory
    const frontendPath = path.join(process.cwd(), 'frontend', 'dialog_prompt.txt');
    if (fs.existsSync(frontendPath)) {
      return fs.readFileSync(frontendPath, 'utf-8');
    }

    // If not found, try root directory
    const rootPath = path.join(process.cwd(), 'dialog_prompt.txt');
    if (fs.existsSync(rootPath)) {
      return fs.readFileSync(rootPath, 'utf-8');
    }

    throw new Error('Dialog prompt file not found');
  } catch (error) {
    console.error('Error reading dialog prompt:', error);
    throw new Error('Failed to read dialog prompt file');
  }
}

// Function to save the generated script
async function saveScript(title: string, script: string): Promise<string> {
  try {
    // Create the book directory if it doesn't exist
    const bookDir = path.join(process.cwd(), 'Boeken', title);
    const dialogDir = path.join(bookDir, 'dialog_texts');
    
    fs.mkdirSync(dialogDir, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `dialog_${timestamp}.txt`;
    const filePath = path.join(dialogDir, filename);

    // Save the script
    fs.writeFileSync(filePath, script, 'utf-8');
    return filePath;
  } catch (error) {
    console.error('Error saving script:', error);
    throw new Error('Failed to save script file');
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
    system:"Geef me alleen de beschrijving van 100 woorden.",
    messages: [
      {
        role: 'user',
        content: `Schrijf een beknopte beschrijving van 100 woorden van het boek '${title}' van ${author}, gebaseerd op deze teksten:\n\n${combinedReviews}.`
      }
    ]
  });

  const content = message.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('No description generated by AI');
  }

  return content.text;
}

// Function to upload text content to S3
async function uploadToS3(content: string | null, folder: string, title: string, existingKey?: string): Promise<{ key: string; url: string }> {
  // If we have an existing key and no new content, return the existing key
  if (existingKey && !content) {
    return {
      key: existingKey,
      url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${existingKey}`
    };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = existingKey || `${folder}/${title}_${timestamp}.txt`;

  if (content) {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || '',
      Key: key,
      Body: content,
      ContentType: 'text/plain',
    });

    await s3Client.send(command);
  }

  return {
    key,
    url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${key}`
  };
}

// Function to store podcast data in DynamoDB
async function storePodcastData(data: Omit<PodcastData, 'updatedAt'>): Promise<void> {
  const command = new PutCommand({
    TableName: DYNAMODB_TABLE_NAME,
    Item: {
      ...data,
      playCount: data.playCount || 0,
      updatedAt: new Date().toISOString(),
    },
  });

  await docClient.send(command);
}

// Function to increment play count
async function incrementPlayCount(podcastId: string): Promise<void> {
  const command = new UpdateCommand({
    TableName: DYNAMODB_TABLE_NAME,
    Key: {
      id: podcastId
    },
    UpdateExpression: 'SET playCount = if_not_exists(playCount, :zero) + :inc, updatedAt = :now',
    ExpressionAttributeValues: {
      ':inc': 1,
      ':zero': 0,
      ':now': new Date().toISOString()
    },
    ReturnValues: 'NONE'
  });

  await docClient.send(command);
}

export async function GET() {
  try {
    // Log environment variables (without sensitive values)
    const envCheck = {
      hasRegion: !!process.env.REGION,
      hasAccessKey: !!process.env.ACCESS_KEY_ID,
      hasSecretKey: !!process.env.SECRET_ACCESS_KEY,
      region: process.env.REGION || 'eu-west-1',
    };
    console.log('Environment check:', envCheck);

    const command = new ScanCommand({
      TableName: DYNAMODB_TABLE_NAME,
    });

    console.log('Attempting to scan DynamoDB table:', DYNAMODB_TABLE_NAME);

    try {
      const response = await docClient.send(command);
      console.log('DynamoDB scan successful, found items:', response.Items?.length || 0);
      
      return NextResponse.json({
        success: true,
        podcasts: response.Items || []
      });
    } catch (dbError) {
      console.error('DynamoDB scan error:', {
        error: dbError,
        message: dbError instanceof Error ? dbError.message : 'Unknown error',
        name: dbError instanceof Error ? dbError.name : 'Unknown error type',
        stack: dbError instanceof Error ? dbError.stack : undefined
      });
      
      return NextResponse.json(
        { error: 'Database operation failed', details: dbError instanceof Error ? dbError.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET route:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown error type',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch podcasts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Validate API keys and configuration
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }
    if (!process.env.S3_BUCKET_NAME) {
      throw new Error('S3 bucket name not configured');
    }

    // Read request body
    const body: ScriptRequest & { script?: string; id?: string } = await request.json();
    const { title, author, reviews, coverImage, libraryLink, script, id } = body;

    // If we have a script and id, this is an update request
    if (script && id) {
      // Get the current podcast data to preserve play count
      const getCommand = new ScanCommand({
        TableName: DYNAMODB_TABLE_NAME,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: {
          ':id': id
        }
      });

      const response = await docClient.send(getCommand);
      const existingPodcast = response.Items?.[0];

      if (!existingPodcast) {
        return NextResponse.json(
          { error: 'Podcast not found' },
          { status: 404 }
        );
      }

      // Upload the edited script to S3
      const transcriptResult = await uploadToS3(script, 'transcript', title);

      // Update DynamoDB with the new transcript key, preserving play count
      await storePodcastData({
        id,
        title,
        author,
        libraryLink,
        coverImage,
        description: existingPodcast.description, // Keep existing description
        audioTranscript: transcriptResult.key,
        playCount: existingPodcast.playCount || 0, // Preserve existing play count
        createdAt: existingPodcast.createdAt,
      });

      return NextResponse.json({
        success: true,
        id,
        transcript: {
          key: transcriptResult.key,
          url: transcriptResult.url
        }
      });
    }

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

    if (!coverImage) {
      return NextResponse.json(
        { error: 'Cover image is required' },
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
      temperature: 0.2,
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

    const scriptContent = content.text;
    
    // Save script to filesystem (keeping this for backward compatibility)
    const scriptPath = await saveScript(title, scriptContent);
    
    // Upload all content to S3
    const [transcriptResult, descriptionResult] = await Promise.all([
      uploadToS3(scriptContent, 'transcript', title),
      uploadToS3(bookDescription, 'description', title),
    ]);
    
    const podcastId = uuidv4();

    // Store metadata in DynamoDB with relative paths
    await storePodcastData({
      id: podcastId,
      title,
      author,
      libraryLink,
      coverImage,
      description: descriptionResult.key,
      audioTranscript: transcriptResult.key,
      playCount: 0,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      id: podcastId,
      script: scriptContent,
      scriptPath,
      description: {
        text: bookDescription,
        key: descriptionResult.key,
        url: descriptionResult.url
      },
      transcript: {
        key: transcriptResult.key,
        url: transcriptResult.url
      }
    });

  } catch (error) {
    console.error('Error generating podcast:', error);
    
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
      { error: 'Failed to generate podcast script' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!process.env.DYNAMODB_TABLE_NAME) {
      throw new Error('DynamoDB table name not configured');
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Podcast ID is required' },
        { status: 400 }
      );
    }

    await incrementPlayCount(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error incrementing play count:', error);
    return NextResponse.json(
      { error: 'Failed to update play count' },
      { status: 500 }
    );
  }
} 