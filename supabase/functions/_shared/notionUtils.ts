export async function retryFetch(url: string, options: RequestInit, retries = 5, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status !== 429) {
      return response;
    }
    console.warn(`[NotionUtils] Rate limit hit (429) for ${url}. Retrying in ${delay / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    delay *= 2; // Exponential backoff
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries due to rate limiting.`);
}