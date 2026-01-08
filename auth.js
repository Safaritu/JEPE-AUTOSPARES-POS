// auth.js
const supabaseUrl = 'https://hoqenpnkmnsfyqsvfvab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcWVucG5rbW5zZnlxc3ZmdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5Mzk5MTUsImV4cCI6MjA4MjUxNTkxNX0.qKqv6NEyCU5ZMNj6Z34kpCiY7NoUzzBggiPSRJdTz0Y';

const initSupabase = () => {
    // Check if the Supabase CDN library is loaded in the global window object
    if (!window.supabase) {
        console.error("Supabase library not detected. Page refresh may be required.");
        return null;
    }

    return window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            // REQUIRED: This allows the client to automatically read the access token 
            // from the email link URL fragments (#access_token=...)
            detectSessionInUrl: true, 
            // Recommended for simple web deployments to handle redirects cleanly
            flowType: 'implicit'
        }
    });
};

export const supabase = initSupabase();
