// Supabase Client Setup
// IMPORTANT: Replace these with your actual Supabase Project URL and Anon Key
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// We load Supabase via CDN in the HTML files before this script
let supabase;
if (typeof supabase !== 'undefined') {
  // If loaded globally via CDN (legacy style or via window.supabase)
  // But usually we use module imports. Since we are in vanilla JS without a bundler yet:
  // We expect the HTML to include: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
}

function initSupabase() {
  if (window.supabase) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  console.warn("Supabase SDK not loaded yet.");
  return null;
}

const Auth = {
  client: null,
  
  getClient() {
    if (!this.client) this.client = initSupabase();
    return this.client;
  },

  async signUp(email, password, fullName) {
    const sb = this.getClient();
    if (!sb) return { error: { message: "Supabase not configured." } };
    
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    return { data, error };
  },

  async signIn(email, password) {
    const sb = this.getClient();
    if (!sb) return { error: { message: "Supabase not configured." } };

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  async signInWithGoogle() {
    const sb = this.getClient();
    if (!sb) return { error: { message: "Supabase not configured." } };

    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/rfm-analysis.html'
      }
    });
    return { data, error };
  },

  async signOut() {
    const sb = this.getClient();
    if (!sb) return;
    await sb.auth.signOut();
    window.location.href = 'login.html';
  },

  async getSession() {
    const sb = this.getClient();
    if (!sb) return null;
    const { data, error } = await sb.auth.getSession();
    return data?.session;
  },
  
  async getUser() {
    const sb = this.getClient();
    if (!sb) return null;
    const { data: { user } } = await sb.auth.getUser();
    return user;
  },

  async requireAuth() {
    // For dashboard protection
    // Check local storage fast for standard Supabase tokens
    const authTokens = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!authTokens) {
      window.location.href = 'login.html';
      return null;
    }
    
    const session = await this.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return null;
    }
    
    // Add user info to UI if it exists
    document.addEventListener('DOMContentLoaded', () => {
      const userBadge = document.getElementById('user-profile-badge');
      if (userBadge && session.user) {
        const name = session.user.user_metadata?.full_name || session.user.email;
        userBadge.textContent = name.charAt(0).toUpperCase();
        userBadge.title = name;
      }
    });
    
    return session.user;
  },
  
  async redirectIfAuthenticated() {
    // For login/signup pages
    const session = await this.getSession();
    if (session) {
      window.location.href = 'rfm-analysis.html';
    }
  }
};
