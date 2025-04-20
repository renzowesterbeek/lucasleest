# RecensieZoeker Feature Documentation

## Overview
The RecensieZoeker (Review Finder) is a feature integrated into the main admin workflow that helps administrators find and extract book reviews and summaries from various Dutch websites. It uses the Brave Search API to find relevant pages and Claude AI to analyze and extract high-quality content. The system also includes podcast generation capabilities and feedback tracking.

## Components

### 1. Frontend Integration (`/admin/page.tsx`)
- Integrated into the main podcast creation workflow
- Features:
  - Automatic review search using book title and author
  - Displays reviews with quality scores
  - Allows editing of review titles and content
  - Shows source URLs for verification
  - Color-coded quality indicators (red < 6, yellow 6-7, green ≥ 8)
  - Fallback to manual review entry when needed
  - Dynamic audio player integration
  - Feedback tracking system
  - Podcast generation capabilities

### 2. Search API (`/api/books/reviews/route.ts`)
- Handles the initial search for review pages
- Uses Brave Search API
- Features:
  - Searches for Dutch content only
  - Filters results based on keywords:
    - 'recensie'
    - 'review'
    - 'gelezen'
    - 'summary'
    - 'samenvatting'
    - 'boek'
  - Excludes bol.com results
  - Returns top 15 most relevant results

### 3. Content Extraction API (`/api/books/fetch-content/route.ts`)
- Analyzes and extracts reviews using Claude AI
- Features:
  - Extracts clean content from web pages
  - Uses Claude 3.5 Haiku for content analysis
  - Rates review quality on a 1-10 scale
  - Translates content to Dutch if needed
  - Returns 4-5 best quality reviews

## Workflow

1. **Initial Setup**
   - Admin enters book title and author in the podcast creation form
   - These fields are used automatically for review search

2. **Search Phase**
   - Admin clicks "Zoek Recensies" button
   - System searches using Brave Search API
   - Results are filtered for relevant keywords
   - Top 15 results are returned

3. **Content Analysis Phase**
   - System automatically fetches content from each URL
   - Claude analyzes each page for:
     - Content relevance
     - Writing quality
     - Content depth
     - Thematic coverage
   - Assigns quality scores based on criteria:
     - 8-10: High-quality, in-depth reviews
     - 6-7: Decent reviews
     - 1-4: Poor quality or irrelevant content
     - Automatic score of 1 for texts < 600 characters

4. **Review Selection and Editing**
   - Best reviews are automatically added to the form
   - Admin can:
     - Edit any review text or title
     - Remove unwanted reviews
     - Add manual reviews if needed
     - View quality scores and source links

5. **Podcast Generation**
   - Admin can generate a script from selected reviews
   - System creates an audio podcast from the script
   - Audio player integration for preview
   - Feedback tracking system for user engagement

## Quality Scoring Criteria

### Positive Factors
- Coverage of book themes
- Character analysis
- Detailed book/author information
- Personal opinions
- Well-written, complete sentences
- Extensive content length

### Negative Factors
- Poor writing quality
- Wrong book/topic
- Short content (< 600 chars = automatic score of 1)
- Superficial analysis

## Technical Details

### Rate Limiting
- Search API: 10 requests per 10 seconds
- Content API: 5 requests per 10 seconds

### Environment Variables Required
- `BRAVE_API_KEY`: For Brave Search API
- `ANTHROPIC_API_KEY`: For Claude AI

### Error Handling
- Validates input parameters
- Handles API failures gracefully
- Returns empty review list on errors
- Provides user-friendly error messages

### Frontend Technologies
- Next.js with TypeScript
- React for UI components
- Tailwind CSS for styling
- Dynamic imports for audio player
- Client-side state management

### Data Models
- Review: Contains text, title, source URL, and quality score
- Podcast: Includes ID, title, author, audio link, and feedback metrics
- SearchResult: Contains URL for review sources
- ReviewResponse: Structured review data with quality scoring

## Maintenance Notes

- Review quality thresholds can be adjusted in `fetch-content/route.ts`
- Search keywords can be modified in `reviews/route.ts`
- Claude prompt can be tuned in `fetch-content/route.ts`
- Frontend styling uses Tailwind CSS classes
- Audio player component is dynamically imported to avoid SSR issues 