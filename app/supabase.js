import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqfgddpyyymgbcgrkxiy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZmdkZHB5eXltZ2JjZ3JreGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNzU4NDAsImV4cCI6MjA4Mjg1MTg0MH0.VUbGyEcGbu77_9LT5btdA9YNXGGrHhA6JJ2oARn6jP0';


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
