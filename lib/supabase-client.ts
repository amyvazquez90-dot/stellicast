import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let client: ReturnType<typeof createBrowserClient> | null = null;
let initPromise: Promise<void> | null = null;

function getSupabaseBrowserClient() {
  if (!client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase browser configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for this deploy context.');
    }
    client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Force token refresh on every getUser/getSession call
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        // Add storage to ensure cookies work correctly
        storage: {
          getItem: (key) => {
            if (typeof window === 'undefined') return null;
            return window.localStorage.getItem(key);
          },
          setItem: (key, value) => {
            if (typeof window === 'undefined') return;
            window.localStorage.setItem(key, value);
          },
          removeItem: (key) => {
            if (typeof window === 'undefined') return;
            window.localStorage.removeItem(key);
          },
        },
      },
    });

    // Initialize session on first client creation
    if (!initPromise) {
      initPromise = (async () => {
        try {
          await client!.auth.getSession();
        } catch (error) {
          console.error('Failed to initialize Supabase session:', error);
        }
      })();
    }
  }
  return client;
}

// Client Components also render on the server during static generation.
// Defer the browser SDK (and session initialization) until an effect or event
// actually uses it. Keep a stable reference for React effect dependencies.
const lazyClient = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, property) {
    const instance = getSupabaseBrowserClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export function createSupabaseBrowserClient() {
  return lazyClient;
}

// Helper function to ensure client is ready
export async function waitForSupabaseInit() {
  getSupabaseBrowserClient();
  if (initPromise) {
    await initPromise;
  }
}
