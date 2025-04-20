/**
 * Utility functions for AWS Cognito authentication
 */

// Import crypto only in server environment
import type { Hmac } from 'crypto';
let crypto: { createHmac: (algorithm: string, key: string) => Hmac };

// Dynamic import for Node.js environment
if (typeof window === 'undefined') {
  // Using dynamic import instead of require
  import('crypto').then((cryptoModule) => {
    crypto = cryptoModule;
  });
}

/**
 * Calculates a SECRET_HASH for Cognito authentication in a way that works in both browser and Node.js environments
 * @param username The Cognito username
 * @param clientId The Cognito app client ID
 * @param clientSecret The Cognito app client secret
 * @returns Promise that resolves to the base64-encoded secret hash
 */
export async function calculateSecretHash(
  username: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  // Check for empty client secret to avoid "HMAC key data must not be empty" error
  if (!clientSecret) {
    return '';
  }
  
  const message = username + clientId;
  
  try {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // Browser environment: Use Web Crypto API
      
      // Encode the message and key
      const encoder = new TextEncoder();
      const messageBuffer = encoder.encode(message);
      const keyBuffer = encoder.encode(clientSecret);
      
      // Import the key for HMAC
      const key = await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Sign the message with the key
      const signature = await window.crypto.subtle.sign(
        'HMAC',
        key,
        messageBuffer
      );
      
      // Convert the signature to base64
      return btoa(Array.from(new Uint8Array(signature)).map(byte => String.fromCharCode(byte)).join(''));
    } else {
      // Server environment: Use Node.js crypto module
      const hmac = crypto.createHmac('sha256', clientSecret);
      hmac.update(message);
      return hmac.digest('base64');
    }
  } catch (error) {
    console.error('Error calculating secret hash:', error);
    throw error;
  }
} 