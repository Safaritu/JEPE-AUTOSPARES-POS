// auth.js - Supabase client initialization
const supabaseUrl = 'https://hoqenpnkmnsfyqsvfvab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcWVucG5rbW5zZnlxc3ZmdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5Mzk5MTUsImV4cCI6MjA4MjUxNTkxNX0.qKqv6NEyCU5ZMNj6Z34kpCiY7NoUzzBggiPSRJdTz0Y';

export const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true 
    }
});

// Helper function to get current user with profile and branch info
export async function getCurrentUser() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select(`
                *,
                branches (
                    id,
                    name,
                    code,
                    location
                )
            `)
            .eq('id', user.id)
            .single();
        
        if (error) {
            console.error("Error fetching profile:", error);
            return { user, profile: null };
        }
        
        return { user, profile };
    } catch (error) {
        console.error("Error in getCurrentUser:", error);
        return null;
    }
}

// Helper function to check if user is admin
export async function isAdmin() {
    const userData = await getCurrentUser();
    return userData?.profile?.role === 'admin';
}

// Helper function to get user's branch ID
export async function getUserBranchId() {
    const userData = await getCurrentUser();
    return userData?.profile?.branch_id;
}

// Helper function to get user's branch details
export async function getUserBranch() {
    const userData = await getCurrentUser();
    return userData?.profile?.branches;
}

// Helper function to add branch filter to queries
export function withBranchFilter(query, branchId) {
    if (branchId) {
        return query.eq('branch_id', branchId);
    }
    return query;
}

// Helper function to get branch-aware query based on current user
export async function getBranchAwareQuery(table, options = {}) {
    const userData = await getCurrentUser();
    let query = supabase.from(table).select(options.select || '*');
    
    // If user is cashier, filter by their branch
    if (userData?.profile?.role === 'cashier' && userData?.profile?.branch_id) {
        query = query.eq('branch_id', userData.profile.branch_id);
    }
    
    // Add any additional filters
    if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
    }
    
    // Add order by
    if (options.orderBy) {
        query = query.order(options.orderBy.column, { 
            ascending: options.orderBy.ascending !== false 
        });
    }
    
    return query;
}

// Helper function to require authentication
export async function requireAuth(redirectTo = 'index.html') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = redirectTo;
        return null;
    }
    return user;
}

// Helper function to require specific role
export async function requireRole(role, redirectTo = 'index.html') {
    const user = await requireAuth(redirectTo);
    if (!user) return null;
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    if (profile?.role !== role) {
        window.location.href = redirectTo;
        return null;
    }
    
    return { user, profile };
}

// Logout helper
export async function logout() {
    localStorage.removeItem('pos_session');
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}
