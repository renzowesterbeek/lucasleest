import { NextResponse } from 'next/server';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { S3 } from '@aws-sdk/client-s3';
import { ElevenLabs } from 'elevenlabs-node';

const dynamoDb = new DynamoDB({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocument.from(dynamoDb);

const s3 = new S3({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

const voice = new ElevenLabs({
  apiKey: process.env.ELEVEN_LABS_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const { id, script } = await request.json();

    if (!id || !script) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate audio using ElevenLabs
    const audioResponse = await voice.textToSpeech({
      // Use Rachel voice
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      // Set model to Eleven Multilingual v2
      modelId: "eleven_multilingual_v2",
      text: script,
    });

    if (!audioResponse) {
      throw new Error('Failed to generate audio');
    }

    // Upload audio to S3
    const audioKey = `audio/${id}.mp3`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: audioKey,
      Body: Buffer.from(audioResponse),
      ContentType: 'audio/mpeg',
    });

    // Update DynamoDB record with audio link
    await docClient.update({
      TableName: 'Books',
      Key: { id },
      UpdateExpression: 'SET audioLink = :audioLink',
      ExpressionAttributeValues: {
        ':audioLink': audioKey,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error generating audio:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
} 