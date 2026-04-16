export function getApiUrl() {
  if (typeof window === 'undefined') {
    const apiUrl = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL in customer environment.');
    }

    return apiUrl;
  }

  if (!process.env.NEXT_PUBLIC_API_URL) {
    throw new Error('Missing NEXT_PUBLIC_API_URL in customer environment.');
  }

  return process.env.NEXT_PUBLIC_API_URL;
}
