// auth.js - Supabase client initialization with session management
const supabaseUrl = 'https://hoqenpnkmnsfyqsvfvab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcWVucG5rbW5zZnlxc3ZmdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5Mzk5MTUsImV4cCI6MjA4MjUxNTkxNX0.qKqv6NEyCU5ZMNj6Z34kpCiY7NoUzzBggiPSRJdTz0Y';

// Create Supabase client
export const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true 
    }
});

// Branch constants - only MUTOMO and KITUI
export const BRANCHES = {
    MUTOMO: { 
        id: '5326e4c6-6d0d-4500-83d9-f322c859b9fb', 
        name: 'MUTOMO BRANCH', 
        code: 'MUT' 
    },
    KITUI: { 
        id: 'ea91a65e-7c6e-43fd-b71e-3f2cc4f714a9', 
        name: 'KITUI BRANCH', 
        code: 'KIT' 
    }
};

// ============================================
// SESSION TIMEOUT MANAGEMENT
// ============================================

const SESSION_KEY = 'pos_session';
const SESSION_TIMEOUT = 10 * 60; // 10 minutes in seconds
const WARNING_THRESHOLD = 60; // Show warning 60 seconds before timeout

let sessionTimeoutId = null;
let countdownInterval = null;
let sessionTimer = SESSION_TIMEOUT;
let sessionStartTime = null;
let currentSessionId = null;

// Initialize session management - call this on every page
export function initSessionManager() {
    // Check if user has valid session
    const sessionData = checkExistingSession();
    
    if (sessionData) {
        // Start the timer
        startSessionTimer();
        setupActivityListeners();
        return sessionData;
    }
    
    return null;
}

// Check if user has a valid session
function checkExistingSession() {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) {
        return null;
    }

    try {
        const sessionData = JSON.parse(session);
        const elapsed = (Date.now() - sessionData.loginTime) / 1000;
        
        if (elapsed < SESSION_TIMEOUT) {
            // Session is still valid
            currentSessionId = sessionData.sessionId || null;
            sessionStartTime = sessionData.loginTime || Date.now();
            return sessionData;
        } else {
            // Session expired
            localStorage.removeItem(SESSION_KEY);
            showSessionExpiredMessage();
            redirectToLogin();
            return null;
        }
    } catch (e) {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

// Start the session timer
function startSessionTimer() {
    clearTimeout(sessionTimeoutId);
    clearInterval(countdownInterval);
    sessionTimer = SESSION_TIMEOUT;
    sessionStartTime = Date.now();
    
    // Update the session in localStorage with new login time
    updateSessionLoginTime();
    
    // Create or get the warning element
    let warningEl = document.getElementById('sessionWarning');
    if (!warningEl) {
        warningEl = createWarningElement();
    }
    const countdownEl = document.getElementById('timeoutCountdown');
    
    countdownInterval = setInterval(() => {
        sessionTimer--;
        
        if (sessionTimer <= WARNING_THRESHOLD && warningEl) {
            const minutes = Math.floor(sessionTimer / 60);
            const seconds = sessionTimer % 60;
            if (countdownEl) {
                countdownEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            warningEl.style.display = 'block';
        }
        
        if (sessionTimer <= 0) {
            clearInterval(countdownInterval);
            clearTimeout(sessionTimeoutId);
            if (warningEl) warningEl.style.display = 'none';
            handleSessionTimeout();
        }
    }, 1000);
    
    sessionTimeoutId = setTimeout(() => {
        clearInterval(countdownInterval);
        if (warningEl) warningEl.style.display = 'none';
        handleSessionTimeout();
    }, SESSION_TIMEOUT * 1000);
}

// Create the warning element if it doesn't exist
function createWarningElement() {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'sessionWarning';
    warningDiv.className = 'session-warning';
    warningDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(239, 68, 68, 0.95);
        color: white;
        padding: 0.8rem 1.5rem;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.85rem;
        z-index: 9999;
        box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        display: none;
        animation: slideUp 0.3s ease;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.1);
        font-family: 'Plus Jakarta Sans', sans-serif;
    `;
    warningDiv.innerHTML = `
        ⏰ Session expiring soon! <span id="timeoutCountdown">10:00</span>
    `;
    document.body.appendChild(warningDiv);
    
    // Add animation styles if not already present
    if (!document.getElementById('sessionWarningStyles')) {
        const style = document.createElement('style');
        style.id = 'sessionWarningStyles';
        style.textContent = `
            @keyframes slideUp {
                from { transform: translateY(100px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    return warningDiv;
}

// Update session login time
function updateSessionLoginTime() {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            sessionData.loginTime = Date.now();
            localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        } catch (e) {
            console.error('Error updating session login time:', e);
        }
    }
}

// Handle session timeout - record sign out and redirect
async function handleSessionTimeout() {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            const userId = sessionData.user?.id;
            
            if (userId && currentSessionId && sessionStartTime) {
                const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
                await recordSignOut(userId, currentSessionId, duration);
            }
        } catch (e) {
            console.error('Error during session timeout cleanup:', e);
        }
    }
    
    localStorage.removeItem(SESSION_KEY);
    currentSessionId = null;
    sessionStartTime = null;
    
    const warningEl = document.getElementById('sessionWarning');
    if (warningEl) warningEl.style.display = 'none';
    
    showSessionExpiredMessage();
    redirectToLogin();
}

// Record sign out to database
async function recordSignOut(userId, sessionId, durationSeconds) {
    try {
        // Update user_sessions
        const { error: sessionError } = await supabase
            .from('user_sessions')
            .update({
                sign_out_time: new Date().toISOString(),
                duration_seconds: durationSeconds
            })
            .eq('id', sessionId);
        
        if (sessionError) {
            console.error('Error updating session:', sessionError);
        }
        
        // Update profile last_sign_out
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
                last_sign_out: new Date().toISOString() 
            })
            .eq('id', userId);
        
        if (profileError) {
            console.error('Error updating last_sign_out:', profileError);
        }
        
    } catch (err) {
        console.error('Error recording sign out:', err);
    }
}

// Reset timer on user activity
function setupActivityListeners() {
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetSessionTimer);
    });
}

// Reset session timer
function resetSessionTimer() {
    // Only reset if user is logged in
    if (localStorage.getItem(SESSION_KEY)) {
        clearTimeout(sessionTimeoutId);
        clearInterval(countdownInterval);
        const warningEl = document.getElementById('sessionWarning');
        if (warningEl) warningEl.style.display = 'none';
        startSessionTimer();
    }
}

// Redirect to login page
function redirectToLogin() {
    const currentPath = window.location.pathname;
    const loginPages = ['index.html', 'login.html', ''];
    const isLoginPage = loginPages.some(page => currentPath.endsWith(page) || currentPath === '/');
    
    if (!isLoginPage && !currentPath.includes('subscriptions')) {
        window.location.href = 'index.html';
    }
}

// Show session expired message
function showSessionExpiredMessage() {
    const container = document.getElementById('message-container');
    if (container) {
        container.innerHTML = `
            <div class="error-message" style="
                background: rgba(239, 68, 68, 0.15);
                border-left: 4px solid #ef4444;
                padding: 12px 15px;
                border-radius: 10px;
                margin: 15px 0;
                color: #fee2e2;
                text-align: left;
            ">
                <i class="fas fa-exclamation-circle"></i> Session expired. Please login again.
            </div>
        `;
    }
}

// ============================================
// EXISTING AUTH FUNCTIONS (unchanged below)
// ============================================

// Get all branches as array
export function getAllBranches() {
    return Object.values(BRANCHES);
}

// Get branch by ID
export function getBranchById(id) {
    if (id === BRANCHES.MUTOMO.id) return BRANCHES.MUTOMO;
    if (id === BRANCHES.KITUI.id) return BRANCHES.KITUI;
    return null;
}

// Get branch by code
export function getBranchByCode(code) {
    if (code === 'MUT') return BRANCHES.MUTOMO;
    if (code === 'KIT') return BRANCHES.KITUI;
    return null;
}

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

// Helper function to create user profile after signup
export async function createUserProfile(userId, email, role, branchId) {
    try {
        const { error } = await supabase
            .from('profiles')
            .insert([{
                id: userId,
                email: email,
                role: role,
                branch_id: branchId,
                full_name: email.split('@')[0]
            }]);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Error creating profile:", error);
        return { success: false, error };
    }
}

// Helper function to update user profile
export async function updateUserProfile(userId, updates) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Error updating profile:", error);
        return { success: false, error };
    }
}

// Helper function to add branch filter to queries
export async function withBranchFilter(query, customBranchId = null) {
    const userData = await getCurrentUser();
    const isAdminUser = userData?.profile?.role === 'admin';
    
    if (customBranchId) {
        return query.eq('branch_id', customBranchId);
    }
    
    if (!isAdminUser && userData?.profile?.branch_id) {
        return query.eq('branch_id', userData.profile.branch_id);
    }
    
    return query;
}

// Helper function to get branch-aware query
export async function getBranchAwareQuery(table, options = {}) {
    const userData = await getCurrentUser();
    const isAdminUser = userData?.profile?.role === 'admin';
    
    let query = supabase.from(table).select(options.select || '*');
    
    if (options.branchId) {
        query = query.eq('branch_id', options.branchId);
    } else if (!isAdminUser && userData?.profile?.branch_id) {
        query = query.eq('branch_id', userData.profile.branch_id);
    }
    
    if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
    }
    
    if (options.orderBy) {
        query = query.order(options.orderBy.column, { 
            ascending: options.orderBy.ascending !== false 
        });
    }
    
    if (options.limit) {
        query = query.limit(options.limit);
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

// Helper function to get session from localStorage
export function getSession() {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
}

// Helper function to set session with session ID
export function setSession(user, profile, sessionId = null) {
    const session = {
        user: user,
        profile: profile,
        branch: profile?.branches,
        role: profile?.role,
        loginTime: Date.now(),
        sessionId: sessionId
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
}

// Helper function to clear session
export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    clearTimeout(sessionTimeoutId);
    clearInterval(countdownInterval);
    currentSessionId = null;
    sessionStartTime = null;
    const warningEl = document.getElementById('sessionWarning');
    if (warningEl) warningEl.style.display = 'none';
}

// Logout helper with session recording
export async function logout() {
    // Record sign out before clearing
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            const userId = sessionData.user?.id;
            
            if (userId && currentSessionId && sessionStartTime) {
                const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
                await recordSignOut(userId, currentSessionId, duration);
            }
        } catch (e) {
            console.error('Error during logout:', e);
        }
    }
    
    clearSession();
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// Initialize auth state listener
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
        // Fetch and cache profile
        supabase
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
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }) => {
                if (profile) {
                    setSession(session.user, profile);
                }
            });
    } else if (event === 'SIGNED_OUT') {
        clearSession();
    }
});

// ============================================
// NEW: Record sign in function
// ============================================

export async function recordSignIn(userId) {
    try {
        const userAgent = navigator.userAgent;
        
        // Insert session record
        const { data: sessionData, error: sessionError } = await supabase
            .from('user_sessions')
            .insert({
                user_id: userId,
                sign_in_time: new Date().toISOString(),
                user_agent: userAgent,
                ip_address: 'client-side'
            })
            .select('id')
            .single();
        
        if (sessionError) {
            console.error('Error recording session:', sessionError);
            return null;
        }
        
        currentSessionId = sessionData.id;
        
        // Update profile last_sign_in
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                last_sign_in: new Date().toISOString() 
            })
            .eq('id', userId);
        
        if (updateError) {
            console.error('Error updating last_sign_in:', updateError);
        }
        
        return sessionData.id;
    } catch (err) {
        console.error('Error in recordSignIn:', err);
        return null;
    }
}
