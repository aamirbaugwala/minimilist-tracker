import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqfgddpyyymgbcgrkxiy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZmdkZHB5eXltZ2JjZ3JreGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNzU4NDAsImV4cCI6MjA4Mjg1MTg0MH0.VUbGyEcGbu77_9LT5btdA9YNXGGrHhA6JJ2oARn6jP0';

export const supabase = createClient(supabaseUrl, supabaseKey);