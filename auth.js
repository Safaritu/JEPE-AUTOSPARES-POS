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

// Branch constants - only MUTOMO and KITUI
export const BRANCHES = {
    MUTOMO: { id: '5326e4c6-6d0d-4500-83d9-f322c859b9fb', name: 'MUTOMO BRANCH', code: 'MUT' },
    KITUI: { id: 'ea91a65e-7c6e-43fd-b71e-3f2cc4f714a9', name: 'KITUI BRANCH', code: 'KIT' }
};

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
// If user is admin and no specific branchId provided, returns query without filter (all branches)
// If user is cashier, always filters by their branch
export async function withBranchFilter(query, customBranchId = null) {
    const userData = await getCurrentUser();
    const isAdminUser = userData?.profile?.role === 'admin';
    
    // If custom branch ID is provided (admin selecting a branch), use that
    if (customBranchId) {
        return query.eq('branch_id', customBranchId);
    }
    
    // If user is cashier, filter by their branch
    if (!isAdminUser && userData?.profile?.branch_id) {
        return query.eq('branch_id', userData.profile.branch_id);
    }
    
    // Admin with no custom filter - return all branches
    return query;
}

// Helper function to get branch-aware query based on current user and optional branch selection
export async function getBranchAwareQuery(table, options = {}) {
    const userData = await getCurrentUser();
    const isAdminUser = userData?.profile?.role === 'admin';
    
    let query = supabase.from(table).select(options.select || '*');
    
    // Apply branch filter based on user role and custom branch
    if (options.branchId) {
        // Admin explicitly selected a branch
        query = query.eq('branch_id', options.branchId);
    } else if (!isAdminUser && userData?.profile?.branch_id) {
        // Cashier - always filter by their branch
        query = query.eq('branch_id', userData.profile.branch_id);
    }
    // Admin with no branch filter - see all branches
    
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
