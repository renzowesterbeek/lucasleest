import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

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

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

// Voice mapping for different speakers
const VOICE_MAPPING = {
  'Lucas': 'XHVuHpUhoVONzkko06jn',  // Lucas v2
  'Betsie': 'dCnu06FiOZma2KVNUoPZ'  // Betsie
};

interface PodcastData {
  id: string;
  title: string;
  author: string;
  libraryLink?: string;
  coverImage: string;
  description: string;
  audioTranscript: string;
  audioLink?: string;
  createdAt: string;
  updatedAt: string;
}

// Function to extract dialog lines from script
function extractDialogLines(script: string): Array<{ speaker: string; text: string }> {
  const lines = script.split('\n');
  const dialogLines: Array<{ speaker: string; text: string }> = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Check if line starts with a speaker name
    const match = trimmedLine.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, speaker, text] = match;
      dialogLines.push({ speaker, text });
    }
  }
  
  return dialogLines;
}

// Function to update DynamoDB with audio link
async function updatePodcastAudioLink(id: string, audioKey: string): Promise<void> {
  const command = new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET audioLink = :audioLink, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':audioLink': audioKey,
      ':updatedAt': new Date().toISOString(),
    },
  });
  await docClient.send(command);
}

// Function to generate audio in the background
async function generateAudioInBackground(id: string, title: string, script: string): Promise<void> {
  try {
    // Validate API key first
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('ElevenLabs API key is missing or empty');
    }

    // Extract dialog lines
    const dialogLines = extractDialogLines(script);
    
    // Generate audio for each line
    const audioSegments: Buffer[] = [];
    let retryCount = 0;
    const maxRetries = 3;
    
    // Track request IDs per speaker for smoother speech
    const speakerRequestIds: { [speaker: string]: string[] } = {};
    
    for (const { speaker, text } of dialogLines) {
      if (!VOICE_MAPPING[speaker]) {
        console.warn(`No voice mapping found for speaker: ${speaker}`);
        continue;
      }

      let success = false;
      retryCount = 0; // Reset retry count for each line

      while (!success && retryCount < maxRetries) {
        try {
          // Get the last 3 request IDs for this speaker
          const previousRequestIds = speakerRequestIds[speaker]?.slice(-3) || [];
          
          // Log the request being made (without the API key)
          console.log(`Making request to ElevenLabs API for speaker ${speaker} with voice ID ${VOICE_MAPPING[speaker]}`);
          
          // Generate audio using ElevenLabs API
          const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_MAPPING[speaker], {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': apiKey,
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.7
              },
              previous_request_ids: previousRequestIds
            })
          });

          if (!response.ok) {
            const errorBody = await response.text().catch(() => 'No error body');
            throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}\nBody: ${errorBody}`);
          }

          // Extract the request ID from the 'History-Item-Id' header
          const requestId = response.headers.get('History-Item-Id');
          if (requestId) {
            if (!speakerRequestIds[speaker]) {
              speakerRequestIds[speaker] = [];
            }
            speakerRequestIds[speaker].push(requestId);
          }

          // Get the audio data as a buffer
          const arrayBuffer = await response.arrayBuffer();
          audioSegments.push(Buffer.from(arrayBuffer));
          success = true;
          
          console.log(`Successfully generated audio for line: "${text.substring(0, 50)}..."`);
        } catch (error) {
          retryCount++;
          console.error(`Error generating audio for line: "${text}" (attempt ${retryCount}/${maxRetries})`, error);
          
          // If we get an Unauthorized error, don't retry
          if (error instanceof Error && error.message.includes('Unauthorized')) {
            throw new Error('Invalid ElevenLabs API key. Please check your configuration.');
          }
          
          if (retryCount < maxRetries) {
            // Exponential backoff for retries
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (audioSegments.length === 0) {
      throw new Error('No audio segments were generated successfully');
    }

    // Concatenate all audio segments
    const combinedAudio = Buffer.concat(audioSegments);

    // Upload to S3 with retries
    let uploadSuccess = false;
    retryCount = 0;
    let audioKey = '';
    
    while (!uploadSuccess && retryCount < maxRetries) {
      try {
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `audio_${title}_${timestamp}.mp3`;
        audioKey = `audio/${filename}`;

        const uploadCommand = new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME || '',
          Key: audioKey,
          Body: combinedAudio,
          ContentType: 'audio/mpeg'
        });

        await s3Client.send(uploadCommand);
        uploadSuccess = true;
        console.log(`Audio saved to S3: ${audioKey}`);

        // Update DynamoDB with the audio link
        await updatePodcastAudioLink(id, audioKey);
        console.log(`DynamoDB updated with audio link for podcast: ${id}`);
      } catch (error) {
        retryCount++;
        console.error(`Error uploading to S3 (attempt ${retryCount}/${maxRetries}):`, error);
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }
    }

    if (!uploadSuccess) {
      throw new Error('Failed to upload audio file to S3 after multiple attempts');
    }
  } catch (error) {
    console.error('Error in audio generation:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

    const body = await request.json();
    const { id, title } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Podcast ID is required' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Book title is required' },
        { status: 400 }
      );
    }

    // Get the podcast data from DynamoDB to access the script
    const command = new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': id,
      },
    });

    const response = await docClient.send(command);
    const podcast = response.Items?.[0] as PodcastData;

    if (!podcast) {
      return NextResponse.json(
        { error: 'Podcast not found' },
        { status: 404 }
      );
    }

    // Get the transcript from S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: podcast.audioTranscript,
    });

    const s3Response = await s3Client.send(getObjectCommand);
    if (!s3Response.Body) {
      throw new Error('Failed to retrieve transcript from S3');
    }

    const script = await s3Response.Body.transformToString();
    if (!script) {
      throw new Error('Retrieved transcript is empty');
    }

    // Start audio generation in the background
    generateAudioInBackground(id, title, script)
      .then(() => {
        console.log(`Audio generation completed for book: ${title}`);
      })
      .catch((error) => {
        console.error(`Audio generation failed for book: ${title}`, error);
      });

    return NextResponse.json({
      success: true,
      message: 'Audio generation started'
    });
  } catch (error) {
    console.error('Error starting audio generation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start audio generation' },
      { status: 500 }
    );
  }
} 