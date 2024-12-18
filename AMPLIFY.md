# AWS Amplify Setup Guide

## Environment Variables

Set the following environment variables in AWS Amplify's Environment Variables section:

```
REGION=eu-west-1
S3_BUCKET_NAME=lucas-leest-audio-books
ACCESS_KEY_ID=[Your AWS Access Key ID]
SECRET_ACCESS_KEY=[Your AWS Secret Access Key]
JWT_SECRET=[Generate a secure random string]
ADMIN_PASSWORD=[Choose a secure password]
```

## Steps to Set Up Environment Variables

1. Go to the AWS Amplify Console
2. Select your app
3. Go to "App settings" > "Environment variables"
4. Add each of the above variables
5. Make sure to click "Save" after adding all variables

## Important Notes

- Never commit actual credentials to the repository
- Use secure, random values for JWT_SECRET
- Choose a strong ADMIN_PASSWORD
- Make sure the ACCESS_KEY_ID and SECRET_ACCESS_KEY have the necessary permissions for S3 and DynamoDB 