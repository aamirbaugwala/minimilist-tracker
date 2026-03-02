import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Custom fetch with retry logic for spotty cellular connections
const customFetch = async (url, options, retries = 3) => {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (err) {
    if (retries > 0 && err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      console.warn(`Cellular drop detected. Retrying... (${retries} attempts left)`);
      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return customFetch(url, options, retries - 1);
    }
    throw err;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch, // Overrides the default fetch to use our retry logic
  },
});
