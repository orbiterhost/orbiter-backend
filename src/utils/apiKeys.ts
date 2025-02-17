export const generateApiKey = () => {
    const prefix = 'key_';
    // Generate 24 random bytes using Web Crypto API
    const buffer = new Uint8Array(24);
    crypto.getRandomValues(buffer);
    
    // Convert to base64url string
    const base64 = btoa(String.fromCharCode(...buffer))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    return prefix + base64;
}

export const hashApiKey = async (key: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
}