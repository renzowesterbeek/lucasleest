This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## AWS Amplify Build Issues

If you encounter build issues or cache-related warnings in AWS Amplify (e.g., "Unable to write cache"), try these steps:

1. Locally:
```bash
# Clear local cache and build files
npm run clean

# Reinstall dependencies
rm -rf node_modules
npm install

# Run all checks before pushing
npm run check:all
```

2. In AWS Amplify Console:
   - Go to App Settings > Build Settings
   - Clear build cache by clicking "Clear build cache"
   - Rebuild the application

## IAM Service Role for AWS Amplify

For deploying with AWS Amplify, you'll need to create a service role with appropriate permissions. An inline policy JSON file has been created in this repository (`amplify-service-role-policy.json`).

### How to use the IAM policy:

1. Go to the AWS IAM Console
2. Create a new role (or use an existing one for Amplify)
3. Choose "AWS service" as the trusted entity type
4. Select "Amplify" as the service
5. In the permissions section, choose "Create inline policy"
6. In the JSON tab, paste the content from `amplify-service-role-policy.json`
7. Name the policy (e.g., "LucasLeestServicePolicy") and create it
8. Complete role creation and note the ARN for use in Amplify console

This policy grants the necessary permissions for:
- S3 bucket operations for audio files
- DynamoDB table access
- Cognito user management
- CloudWatch logging

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Code Quality and AWS Amplify Deployment

Before deploying to AWS Amplify, run the following commands to catch potential build issues locally:

```bash
# Run all checks (recommended before pushing)
npm run check:all

# Only run strict linting
npm run lint:strict

# Automatically fix linting issues
npm run lint:fix

# Only run type checking
npm run type-check
```

These commands will help catch common issues that might fail the AWS Amplify build:
- Unused imports
- TypeScript errors
- ESLint violations
- Type checking issues

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.