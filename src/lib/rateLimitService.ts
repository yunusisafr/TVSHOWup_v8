import { supabase } from './supabase';

export interface UsageLimits {
  dailyLimit: number;
  bonusLimit: number;
  usedCount: number;
  remaining: number;
  resetAt: string;
}

export interface RewardType {
  type: 'ad_click' | 'page_view' | 'list_created';
  amount: number;
}

const GUEST_DAILY_LIMIT = 5;
const USER_DAILY_LIMIT = 25;
const ADMIN_DAILY_LIMIT = 100;

const REWARD_AMOUNTS = {
  ad_click: 5,
  page_view: 1,
  list_created: 5,
};

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('aiChatSessionId');
  if (!sessionId) {
    sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('aiChatSessionId', sessionId);
  }
  return sessionId;
}

function getBaseDailyLimit(isAdmin: boolean, isAuthenticated: boolean): number {
  if (isAdmin) return ADMIN_DAILY_LIMIT;
  if (isAuthenticated) return USER_DAILY_LIMIT;
  return GUEST_DAILY_LIMIT;
}

export const rateLimitService = {
  async getUserLimits(userId: string | null, isAdmin: boolean = false): Promise<UsageLimits | null> {
    try {
      const isAuthenticated = !!userId;
      const sessionId = isAuthenticated ? null : getSessionId();
      const baseLimit = getBaseDailyLimit(isAdmin, isAuthenticated);

      console.log('🔍 Fetching user limits:', { userId, sessionId, isAdmin });

      const { data, error } = await supabase.rpc('check_and_reset_ai_chat_limits', {
        p_user_id: userId,
        p_session_id: sessionId,
      });

      if (error) {
        console.warn('⚠️ Rate limit check failed, using fallback:', error.message);
        return {
          dailyLimit: baseLimit,
          bonusLimit: 0,
          usedCount: 0,
          remaining: baseLimit,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No limit record found, will be auto-created on next check');
        return {
          dailyLimit: baseLimit,
          bonusLimit: 0,
          usedCount: 0,
          remaining: baseLimit,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      }

      const dbRecord = data[0];
      const limits = {
        dailyLimit: dbRecord.daily_limit,
        bonusLimit: dbRecord.bonus_limit,
        usedCount: dbRecord.used_count,
        remaining: dbRecord.remaining,
        resetAt: dbRecord.reset_at,
      };
      console.log('✅ Fetched limits from DB:', limits);
      return limits;
    } catch (error) {
      console.warn('⚠️ Rate limit service error, using fallback:', error);
      const isAuthenticated = !!userId;
      const baseLimit = getBaseDailyLimit(isAdmin, isAuthenticated);
      return {
        dailyLimit: baseLimit,
        bonusLimit: 0,
        usedCount: 0,
        remaining: baseLimit,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }
  },

  async initializeUserLimits(userId: string | null, isAdmin: boolean = false): Promise<boolean> {
    try {
      const isAuthenticated = !!userId;
      const sessionId = isAuthenticated ? null : getSessionId();
      const baseLimit = getBaseDailyLimit(isAdmin, isAuthenticated);

      const { error } = await supabase.from('ai_chat_usage_limits').insert({
        user_id: userId,
        session_id: sessionId,
        daily_limit: baseLimit,
        bonus_limit: 0,
        used_count: 0,
        last_reset_at: new Date().toISOString(),
      });

      if (error && error.code !== '23505') {
        console.error('Error initializing limits:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in initializeUserLimits:', error);
      return false;
    }
  },

  async incrementUsage(userId: string | null, isAdmin: boolean = false): Promise<boolean> {
    if (isAdmin) {
      console.log('🔓 Admin user - bypassing rate limit');
      return true;
    }

    try {
      const isAuthenticated = !!userId;
      const sessionId = isAuthenticated ? null : getSessionId();

      console.log('🔼 Incrementing usage for:', { userId, sessionId });

      const limits = await this.getUserLimits(userId, isAdmin);
      if (!limits) {
        console.warn('⚠️ Could not get limits - this will be auto-created by RPC');
      } else {
        console.log('📊 Current limits before increment:', limits);
      }

      const { data, error } = await supabase.rpc('increment_ai_chat_usage', {
        p_user_id: userId,
        p_session_id: sessionId,
      });

      if (error) {
        console.error('❌ Increment RPC error:', error);
        return false;
      }

      const success = data === true;
      console.log(`✅ Increment RPC result: ${success ? 'SUCCESS' : 'FAILED (limit reached)'}`);
      return success;
    } catch (error) {
      console.error('⚠️ Rate limit increment failed:', error);
      return false;
    }
  },

  async addReward(userId: string, rewardType: RewardType['type']): Promise<boolean> {
    if (!userId) return false;

    try {
      const amount = REWARD_AMOUNTS[rewardType];

      const { data, error } = await supabase.rpc('add_ai_chat_bonus', {
        p_user_id: userId,
        p_reward_type: rewardType,
        p_amount: amount,
      });

      if (error) {
        console.error('Error adding reward:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error in addReward:', error);
      return false;
    }
  },

  async trackPageView(userId: string | null): Promise<void> {
    if (!userId) return;

    const lastView = sessionStorage.getItem('lastPageViewReward');
    const now = Date.now();

    if (lastView && now - parseInt(lastView) < 60000) {
      return;
    }

    const success = await this.addReward(userId, 'page_view');
    if (success) {
      sessionStorage.setItem('lastPageViewReward', now.toString());
    }
  },

  async trackListCreation(userId: string | null): Promise<void> {
    if (!userId) return;
    await this.addReward(userId, 'list_created');
  },

  async trackAdClick(userId: string | null): Promise<void> {
    if (!userId) return;

    const lastClick = sessionStorage.getItem('lastAdClickReward');
    const now = Date.now();

    if (lastClick && now - parseInt(lastClick) < 300000) {
      return;
    }

    const success = await this.addReward(userId, 'ad_click');
    if (success) {
      sessionStorage.setItem('lastAdClickReward', now.toString());
    }
  },

  formatResetTime(resetAt: string, languageCode: string = 'en'): string {
    const resetDate = new Date(resetAt);
    const now = new Date();
    const diff = resetDate.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (languageCode === 'tr') {
      if (hours > 0) {
        return `${hours} saat ${minutes} dakika`;
      }
      return `${minutes} dakika`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  },
};
