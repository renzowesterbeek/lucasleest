import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AudioContext, AudioBuffer } from 'node-web-audio-api';
import toWav from 'audiobuffer-to-wav';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.NEXT_PUBLIC_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
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

// Create a single AudioContext for the entire process
let globalAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext();
  }
  return globalAudioContext;
}

async function closeAudioContext() {
  if (globalAudioContext) {
    await globalAudioContext.close();
    globalAudioContext = null;
  }
}

// Function to combine audio buffers with silence between segments
async function combineAudioBuffers(audioBuffers: AudioBuffer[], silenceDuration: number = 0.5): Promise<AudioBuffer> {
  const audioContext = getAudioContext();
  
  // Calculate total duration including silence between segments
  const totalDuration = audioBuffers.reduce((acc, buffer) => {
    return acc + buffer.duration + silenceDuration;
  }, 0);

  // Create a new buffer for the combined audio
  const combinedBuffer = new AudioBuffer({
    numberOfChannels: 2,
    length: Math.ceil(audioContext.sampleRate * totalDuration),
    sampleRate: audioContext.sampleRate
  });

  // Fill the channels
  for (let channel = 0; channel < 2; channel++) {
    const outputData = combinedBuffer.getChannelData(channel);
    let currentOffset = 0;

    for (const buffer of audioBuffers) {
      // Copy audio data
      const inputData = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
      outputData.set(inputData, currentOffset);
      
      // Move offset past this segment and the silence gap
      currentOffset += buffer.length + Math.ceil(audioContext.sampleRate * silenceDuration);
    }
  }

  return combinedBuffer;
}

// Function to convert audio data to AudioBuffer
async function arrayBufferToAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const audioContext = getAudioContext();
  return await audioContext.decodeAudioData(arrayBuffer);
}

interface AudioGenerationResponse {
  request_id?: string;
  audio: ArrayBuffer;
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
    // Extract dialog lines
    const dialogLines = extractDialogLines(script);
    
    // Generate audio for each line
    const audioBuffers: AudioBuffer[] = [];
    let retryCount = 0;
    const maxRetries = 3;
    
    // Track request IDs per speaker
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

          // Generate audio using ElevenLabs API
          const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_MAPPING[speaker], {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
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
            throw new Error(`ElevenLabs API error: ${response.statusText}`);
          }

          // Extract the request ID from the 'History-Item-Id' header
          const requestId = response.headers.get('History-Item-Id');
          if (requestId) {
            if (!speakerRequestIds[speaker]) {
              speakerRequestIds[speaker] = [];
            }
            speakerRequestIds[speaker].push(requestId);
          }

          // Get the audio data directly as ArrayBuffer
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await arrayBufferToAudioBuffer(arrayBuffer);
          audioBuffers.push(audioBuffer);
          success = true;

        } catch (error) {
          retryCount++;
          console.error(`Error generating audio for line: ${text} (attempt ${retryCount}/${maxRetries})`, error);
          if (retryCount < maxRetries) {
            // Exponential backoff for retries
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }
      }

      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (audioBuffers.length === 0) {
      throw new Error('No audio segments were generated successfully');
    }

    // Combine all audio buffers with silence between them
    const combinedBuffer = await combineAudioBuffers(audioBuffers);

    // Convert to WAV format
    const wavData = toWav(combinedBuffer);

    // Upload to S3 with retries
    let uploadSuccess = false;
    retryCount = 0;
    let audioKey = '';
    
    while (!uploadSuccess && retryCount < maxRetries) {
      try {
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `audio_${title}_${timestamp}.wav`;
        audioKey = `audio/${filename}`;

        const uploadCommand = new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME || '',
          Key: audioKey,
          Body: Buffer.from(wavData),
          ContentType: 'audio/wav'
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
  } finally {
    // Clean up audio context
    await closeAudioContext();
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