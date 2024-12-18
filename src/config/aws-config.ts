export const awsConfig = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'eu-west-1',
  s3: {
    bucket: process.env.NEXT_PUBLIC_S3_BUCKET || 'lucas-leest-audio-books',
    audioPrefix: 'audio/',
  },
};