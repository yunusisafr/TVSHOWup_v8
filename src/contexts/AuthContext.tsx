import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { databaseService } from '../lib/database'
import { useCallback } from 'react'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordResetEmail: (email: string, languageCode?: string) => Promise<void>
  fetchUserProfile: (userId: string) => Promise<void>
  userProfile: any | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log('🔄 Fetching user profile for:', userId);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        
        // If the profile doesn't exist, try to create it
        if (error.code === 'PGRST116') {
          console.log('User profile not found, creating a new one...');
          const success = await createUserProfile(userId);
          
          if (success) {
            // Wait a moment for the database to sync
            await new Promise(resolve => setTimeout(resolve, 500));

            // Try fetching the profile again
            const { data: newData, error: newError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();

            if (!newError && newData) {
              console.log('✅ Profile fetched after creation:', newData);
              setUserProfile(newData);
              // Use setTimeout to ensure UI updates properly
              setTimeout(() => setLoading(false), 100);
              return;
            } else {
              console.error('Error fetching newly created profile:', newError);
            }
          }
        }
        // Always set loading to false on error to prevent infinite loading
        setTimeout(() => setLoading(false), 100);
      } else if (data) {
        console.log('✅ User profile fetched successfully:', data);
        console.log('📝 Display name from profile:', data?.display_name);
        setUserProfile(data);
        // Use setTimeout to ensure UI updates properly
        setTimeout(() => setLoading(false), 100);
      } else {
        // Profile doesn't exist, create it
        console.log('❌ No profile found, creating one...');
        const success = await createUserProfile(userId);
        if (success) {
          // Retry fetching after creation
          setTimeout(() => {
            fetchUserProfile(userId);
          }, 1000);
        } else {
          setTimeout(() => setLoading(false), 100);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching user profile:', err);
      // Always set loading to false on error to prevent infinite loading
      setTimeout(() => setLoading(false), 100);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!displayName || displayName.trim() === '') {
      throw new Error('Display name is required');
    }
    
    console.log('📝 Signing up with display name:', displayName);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          displayName: displayName.trim(),
        },
      },
    });
    if (error) throw error;
    
    // Create user profile record after successful registration
    console.log('✅ Signup successful, waiting for user session...');
  };

  const signOut = async () => {
    try {
      // Clear stale tokens first to prevent refresh token errors
      clearStaleTokens();
      
      console.log('🚪 Signing out user...');
      // Always clear local state first
      setUser(null);
      setSession(null);
      setUserProfile(null);
      console.log('🧹 Local session state cleared');

      // Then try to sign out from Supabase
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Supabase signOut error:', error);
        // We don't throw the error since we've already cleared local state
      } else {
        console.log('✅ User signed out successfully from Supabase');
      }
      
      return true;
    } catch (error) {
      console.error('Error during sign out:', error);
      return false;
    }
  };
  
  // Clear any stale tokens if no user session exists
  const clearStaleTokens = () => {
    const keys = Object.keys(localStorage);
    const supabaseKeys = keys.filter(key => 
      key.startsWith('sb-') && 
      (key.includes('-auth-token') || key.includes('-session'))
    );
    if (supabaseKeys.length > 0) {
      console.log('🧹 Clearing stale Supabase tokens from localStorage');
      supabaseKeys.forEach(key => localStorage.removeItem(key));
    }
  };

  // Create a user profile if it doesn't exist
  const createUserProfile = async (userId: string): Promise<boolean> => {
    console.log('🔄 Creating user profile for:', userId);
    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        console.error('❌ No user data available');
        return false;
      }

      // Display name is taken from user_metadata
      const initialDisplayName = userData.user.user_metadata?.displayName || 
                                userData.user.email?.split('@')[0] || 
                                `user${Math.floor(Math.random() * 10000)}`;
      
      console.log('📝 Creating profile with display_name:', initialDisplayName);
      console.log('📝 User metadata:', userData.user.user_metadata);

      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: userData.user.email || '',
          display_name: initialDisplayName,
          avatar_url: userData.user.user_metadata?.avatar_url || null,
          country_code: 'US',
          language_code: 'en',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error creating user profile:', error);
        return false;
      } else {
        console.log('✅ User profile created successfully:', data);
        return true;
      }
    } catch (err) {
      console.error('Unexpected error creating user profile:', err);
      return false;
    }
  };

  const sendPasswordResetEmail = async (email: string, languageCode?: string) => {
    const userLanguage = languageCode || 'en';
    const redirectUrl = `${window.location.origin}/reset-password`;

    console.log('🔑 Sending password reset email');
    console.log('   - User language preference:', userLanguage);
    console.log('   - Generic redirect URL:', redirectUrl);
    console.log('   - Language will be detected from cookie on redirect page');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw error;

    console.log('✅ Password reset email sent successfully to:', email);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        console.log('🔑 Initial session found, fetching profile for:', session.user.id);
        fetchUserProfile(session.user.id);
      } else {
        console.log('🔒 No initial session found');
        clearStaleTokens();
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Error getting initial session:', error);
      if (error.message?.includes('refresh_token_not_found') || 
          error.message?.includes('Invalid Refresh Token')) {
        console.log('🧹 Invalid refresh token detected, clearing tokens');
        signOut();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.id);
      setSession(session);
      
      // Handle different auth events
      if (event === 'TOKEN_REFRESHED') {
        if (session) {
          console.log('🔑 Token refreshed successfully');
          setUser(session.user);
          // Ensure profile is fetched after token refresh
          if (session.user?.id) {
            fetchUserProfile(session.user.id);
          }
        } else {
          console.log('❌ Token refresh failed, signing out user');
          // Clear everything on token refresh failure
          setUser(null);
          setUserProfile(null);
          clearStaleTokens();
          setLoading(false);
          return;
        }
      } else {
        setUser(session?.user ?? null);
        // Only set loading to true if we have a user and need to fetch profile
        if (session?.user?.id) {
          setLoading(true);
        }
      }

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        console.log('👋 User signed out or deleted');
        setUserProfile(null);
        clearStaleTokens();
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('🔄 Token refresh failed, signing out user');
        await signOut();
        setLoading(false);
      } else if (event === 'SIGNED_IN' && session?.user?.id) {
        console.log('👤 User signed in, fetching profile for:', session.user.id);
        fetchUserProfile(session.user.id);
      } else if (event === 'SIGNED_UP' && session?.user?.id) {
        console.log('🆕 New user signed up, creating profile for:', session.user.id);
        // Create profile for new user
        const success = await createUserProfile(session.user.id);
        if (success) {
          // Fetch profile after creation
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 1000);
        }
      } else if (session?.user?.id) {
        console.log('👤 User signed in, fetching profile for:', session.user.id);
        fetchUserProfile(session.user.id);
      } else if (!session && event !== 'INITIAL_SESSION') {
        console.log('🚪 Session lost without explicit sign out, cleaning up');
        setUserProfile(null);
        clearStaleTokens();
        setLoading(false);
      } else if (event === 'INITIAL_SESSION') {
        // Just update loading state for initial session
        if (!session) {
          setLoading(false);
        }
      } else {
        clearStaleTokens();
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);  // Empty dependency array

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, sendPasswordResetEmail, userProfile, fetchUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;