// auth.js
const supabaseUrl = 'https://hoqenpnkmnsfyqsvfvab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcWVucG5rbW5zZnlxc3ZmdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5Mzk5MTUsImV4cCI6MjA4MjUxNTkxNX0.qKqv6NEyCU5ZMNj6Z34kpCiY7NoUzzBggiPSRJdTz0Y';

// Create the client directly to ensure it is exported immediately
export const supabase = window.supabase 
    ? window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true // Crucial for reset password links
        }
    })
    : null;

// Fallback for slow connections
if (!supabase) {
    console.warn("Supabase not initialized yet. Page may need a refresh.");
}
