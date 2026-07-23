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

// Branch constants
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
// SESSION MANAGEMENT
// ============================================

const SESSION_KEY = 'pos_session';
const SESSION_TIMEOUT = 10 * 60;
const WARNING_THRESHOLD = 60;

let sessionTimeoutId = null;
let countdownInterval = null;
let sessionTimer = SESSION_TIMEOUT;
let sessionStartTime = null;
let currentSessionId = null;

// Initialize session management
export function initSessionManager() {
    // Check if we're on a login page - if so, don't redirect
    const currentPath = window.location.pathname;
    const loginPages = ['index.html', 'login.html', ''];
    const isLoginPage = loginPages.some(page => currentPath.endsWith(page) || currentPath === '/');
    
    if (isLoginPage) {
        return null;
    }
    
    const sessionData = checkExistingSession();
    
    if (sessionData) {
        startSessionTimer();
        setupActivityListeners();
        return sessionData;
    }
    
    showSessionExpired();
    return null;
}

function showSessionExpired() {
    const overlay = document.getElementById('sessionExpiredOverlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

function checkExistingSession() {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) {
        return null;
    }

    try {
        const sessionData = JSON.parse(session);
        const elapsed = (Date.now() - sessionData.loginTime) / 1000;
        
        if (elapsed < SESSION_TIMEOUT) {
            currentSessionId = sessionData.sessionId || null;
            sessionStartTime = sessionData.loginTime || Date.now();
            return sessionData;
        } else {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
    } catch (e) {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

function startSessionTimer() {
    clearTimeout(sessionTimeoutId);
    clearInterval(countdownInterval);
    sessionTimer = SESSION_TIMEOUT;
    sessionStartTime = Date.now();
    
    updateSessionLoginTime();
    
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

function createWarningElement() {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'sessionWarning';
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
        <button class="close-warning" onclick="this.parentElement.style.display='none'" style="background:none;border:none;color:white;font-size:1.2rem;cursor:pointer;margin-left:10px;">×</button>
    `;
    document.body.appendChild(warningDiv);
    
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

// ============================================
// RECORD SIGN OUT - FIXED to properly update all columns
// ============================================
export async function recordSignOut(userId, sessionId, durationSeconds) {
    try {
        console.log(`📝 Recording sign out for user ${userId}, duration: ${durationSeconds}s`);
        console.log(`📝 Session ID: ${sessionId}`);
        
        const now = new Date().toISOString();
        
        // 1. Update user_sessions table
        if (sessionId) {
            const { error: sessionError } = await supabase
                .from('user_sessions')
                .update({
                    sign_out_time: now,
                    duration_seconds: durationSeconds
                })
                .eq('id', sessionId);
            
            if (sessionError) {
                console.error('❌ Error updating session:', sessionError);
            } else {
                console.log('✅ Session updated successfully');
            }
        } else {
            console.log('⚠️ No session ID provided, skipping session update');
        }
        
        // 2. Update profiles table - last_sign_out and total_session_time
        // First, get current total_session_time
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('total_session_time')
            .eq('id', userId)
            .single();
        
        if (fetchError) {
            console.error('❌ Error fetching profile:', fetchError);
            // Try to update anyway with just last_sign_out
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    last_sign_out: now
                })
                .eq('id', userId);
            
            if (updateError) {
                console.error('❌ Error updating profile (fallback):', updateError);
            }
            return;
        }
        
        const currentTotal = profile?.total_session_time || 0;
        const newTotal = currentTotal + durationSeconds;
        
        console.log(`📊 Current total: ${currentTotal}s, Adding: ${durationSeconds}s, New total: ${newTotal}s`);
        
        // Update both last_sign_out and total_session_time
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                last_sign_out: now,
                total_session_time: newTotal
            })
            .eq('id', userId);
        
        if (updateError) {
            console.error('❌ Error updating profile:', updateError);
        } else {
            console.log(`✅ Profile updated: last_sign_out = ${now}, total_session_time = ${newTotal}s (${Math.floor(newTotal / 60)} minutes)`);
        }
        
    } catch (err) {
        console.error('❌ Error in recordSignOut:', err);
    }
}

// ============================================
// HANDLE SESSION TIMEOUT
// ============================================
async function handleSessionTimeout() {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            const userId = sessionData.user?.id;
            
            if (userId && currentSessionId && sessionStartTime) {
                const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
                console.log(`⏰ Session timed out after ${duration} seconds`);
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
    
    showSessionExpired();
}

// Reset timer on user activity
function setupActivityListeners() {
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetSessionTimer);
    });
}

function resetSessionTimer() {
    if (localStorage.getItem(SESSION_KEY)) {
        clearTimeout(sessionTimeoutId);
        clearInterval(countdownInterval);
        const warningEl = document.getElementById('sessionWarning');
        if (warningEl) warningEl.style.display = 'none';
        startSessionTimer();
    }
}

// ============================================
// RECORD SIGN IN - FIXED to properly update last_sign_in
// ============================================
export async function recordSignIn(userId) {
    try {
        console.log(`📝 Recording sign in for user ${userId}`);
        const userAgent = navigator.userAgent;
        const now = new Date().toISOString();
        
        // 1. Insert session record
        const { data: sessionData, error: sessionError } = await supabase
            .from('user_sessions')
            .insert({
                user_id: userId,
                sign_in_time: now,
                user_agent: userAgent,
                ip_address: 'client-side'
            })
            .select('id')
            .single();
        
        if (sessionError) {
            console.error('❌ Error recording session:', sessionError);
            return null;
        }
        
        currentSessionId = sessionData.id;
        console.log(`✅ Session recorded with ID: ${currentSessionId}`);
        
        // 2. Update profile last_sign_in
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                last_sign_in: now
            })
            .eq('id', userId);
        
        if (updateError) {
            console.error('❌ Error updating last_sign_in:', updateError);
        } else {
            console.log(`✅ last_sign_in updated successfully: ${now}`);
        }
        
        return sessionData.id;
    } catch (err) {
        console.error('❌ Error in recordSignIn:', err);
        return null;
    }
}

// ============================================
// LOGOUT - ENSURES RECORDING HAPPENS
// ============================================
export async function logout() {
    console.log('🚪 Logging out...');
    
    const session = localStorage.getItem(SESSION_KEY);
    let userId = null;
    let sessionId = null;
    let duration = 0;
    
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            userId = sessionData.user?.id;
            sessionId = currentSessionId || sessionData.sessionId;
            
            if (sessionStartTime) {
                duration = Math.floor((Date.now() - sessionStartTime) / 1000);
                console.log(`📊 Session duration: ${duration} seconds`);
            }
        } catch (e) {
            console.error('Error parsing session data:', e);
        }
    }
    
    // Record sign out BEFORE clearing anything
    if (userId && sessionId) {
        console.log(`📝 Recording sign out for user ${userId}, session ${sessionId}, duration ${duration}s`);
        await recordSignOut(userId, sessionId, duration);
    } else {
        console.log('⚠️ No session data to record during logout');
    }
    
    // Now clear everything
    clearSession();
    
    try {
        await supabase.auth.signOut();
    } catch (err) {
        console.error('Error signing out from Supabase:', err);
    }
    
    window.location.href = 'index.html';
}

// ============================================
// EXISTING AUTH FUNCTIONS
// ============================================

export function getAllBranches() {
    return Object.values(BRANCHES);
}

export function getBranchById(id) {
    if (id === BRANCHES.MUTOMO.id) return BRANCHES.MUTOMO;
    if (id === BRANCHES.KITUI.id) return BRANCHES.KITUI;
    return null;
}

export function getBranchByCode(code) {
    if (code === 'MUT') return BRANCHES.MUTOMO;
    if (code === 'KIT') return BRANCHES.KITUI;
    return null;
}

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

export async function isAdmin() {
    const userData = await getCurrentUser();
    return userData?.profile?.role === 'admin';
}

export async function getUserBranchId() {
    const userData = await getCurrentUser();
    return userData?.profile?.branch_id;
}

export async function getUserBranch() {
    const userData = await getCurrentUser();
    return userData?.profile?.branches;
}

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

export async function requireAuth(redirectTo = 'index.html') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = redirectTo;
        return null;
    }
    return user;
}

export async function requireRole(role, redirectTo = 'index.html') {
    const user = await requireAuth(redirectTo);
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', user.id)
        .single();

    if (!profile || profile.status !== 'approved') {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return null;
    }

    if (profile.role !== role) {
        window.location.href = redirectTo;
        return null;
    }

    return { user, profile };
}

export function getSession() {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
}

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

export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    clearTimeout(sessionTimeoutId);
    clearInterval(countdownInterval);
    currentSessionId = null;
    sessionStartTime = null;
    const warningEl = document.getElementById('sessionWarning');
    if (warningEl) warningEl.style.display = 'none';
}

// ============================================
// AUTO-REFRESH ON INACTIVITY
// After 5 minutes with no clicks/keys/mouse movement/scrolling/touches,
// reload the page so any live data on screen (floats, balances, sales
// lists) doesn't sit stale while a cashier/admin has stepped away.
// Separate from the 10-minute SESSION_TIMEOUT above - that one logs the
// user out; this one only reloads the page, session stays intact as
// long as real activity happened within the last 10 minutes.
// Self-initializes wherever auth.js is imported, skipping the login
// page (an idle reload there would wipe out a half-typed email/password).
// ============================================
const AUTO_REFRESH_TIMEOUT = 5 * 60 * 1000;
let autoRefreshTimeoutId = null;

function initAutoRefresh() {
    const currentPath = window.location.pathname;
    const skipPages = ['index.html', 'login.html', ''];
    const isSkipPage = skipPages.some(page => currentPath.endsWith(page) || currentPath === '/');
    if (isSkipPage) return;

    const resetAutoRefreshTimer = () => {
        clearTimeout(autoRefreshTimeoutId);
        autoRefreshTimeoutId = setTimeout(() => {
            window.location.reload();
        }, AUTO_REFRESH_TIMEOUT);
    };

    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetAutoRefreshTimer, { passive: true });
    });

    resetAutoRefreshTimer();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoRefresh);
} else {
    initAutoRefresh();
}

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
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

export async function getUserTotalSessionTime(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('total_session_time')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        return data?.total_session_time || 0;
    } catch (error) {
        console.error('Error getting total session time:', error);
        return 0;
    }
}

export async function getUserSessionHistory(userId, limit = 10) {
    try {
        const { data, error } = await supabase
            .from('user_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('sign_in_time', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting session history:', error);
        return [];
    }
}
