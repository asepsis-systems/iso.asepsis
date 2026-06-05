// Generate a simple token signature that is verified in Next.js Middleware
// Since Middleware runs in Edge runtime, we use WebCrypto and avoid static imports of Node.js 'crypto'.
const JWT_SECRET = process.env.JWT_SECRET || 'iso-asepsis-super-secret-key-12345!';

export async function signToken(payload: { userId: string; username: string; role: string }): Promise<string> {
  const header = b64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours
  const body = b64UrlEncode(JSON.stringify({ ...payload, exp }));
  
  const signature = await hmacSha256(`${header}.${body}`, JWT_SECRET);
  return `${header}.${body}.${signature}`;
}

export async function verifyToken(token: string): Promise<{ userId: string; username: string; role: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('verifyToken: invalid parts length =', parts.length);
      return null;
    }
    const [header, body, signature] = parts;
    
    // Verify signature
    const expectedSignature = await hmacSha256(`${header}.${body}`, JWT_SECRET);
    if (signature !== expectedSignature) {
      console.log('verifyToken: signature mismatch! got =', signature, 'expected =', expectedSignature);
      return null;
    }
    
    // Verify expiration
    const decodedBody = JSON.parse(b64UrlDecode(body));
    if (decodedBody.exp < Math.floor(Date.now() / 1000)) {
      console.log('verifyToken: token expired! exp =', decodedBody.exp, 'now =', Math.floor(Date.now() / 1000));
      return null; // Expired
    }
    
    return decodedBody;
  } catch (e) {
    console.error('verifyToken: exception occurred:', e);
    return null;
  }
}

// Helper: base64url encode using standard Web APIs
function b64UrlEncode(str: string): string {
  const binary = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  });
  const b64 = btoa(binary);
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Helper: base64url decode using standard Web APIs
function b64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  return decodeURIComponent(Array.prototype.map.call(binary, (c: string) => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

// Helper: hmac sha256 that works in both Node.js and WebCrypto environments without dynamic imports
async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  // Get global crypto object. Works in Edge and modern Node.js out of the box.
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : null;
  
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('WebCrypto API (crypto.subtle) no está disponible en este entorno.');
  }
  
  const key = await cryptoObj.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await cryptoObj.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  const binary = hashArray.map(b => String.fromCharCode(b)).join('');
  const b64 = btoa(binary);
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
