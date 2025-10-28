import { supabase } from './supabase';
import { isAdminRoute } from './utils';

interface AdUnit {
  id: string;
  name: string;
  position: string;
  ad_code: string;
  is_active: boolean;
}

let adUnitsCache: AdUnit[] = [];
let adUnitsByPosition: Map<string, AdUnit[]> = new Map();
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export const loadAdUnits = async (): Promise<void> => {
  if (isAdminRoute()) return;

  const now = Date.now();
  if (adUnitsCache.length > 0 && now - cacheTimestamp < CACHE_DURATION) {
    return;
  }

  try {
    const { data, error } = await supabase
      .from('ad_units')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error loading ad units:', error);
      return;
    }

    adUnitsCache = data || [];
    cacheTimestamp = now;

    adUnitsByPosition = new Map();
    adUnitsCache.forEach(ad => {
      const existing = adUnitsByPosition.get(ad.position) || [];
      adUnitsByPosition.set(ad.position, [...existing, ad]);
    });

    console.log(`📢 Loaded ${adUnitsCache.length} active ad units`);
  } catch (error) {
    console.error('Error loading ad units:', error);
  }
};

export const getAdsByPosition = (position: string): AdUnit[] => {
  if (isAdminRoute()) return [];
  return adUnitsByPosition.get(position) || [];
};

export const hasAdsForPosition = (position: string): boolean => {
  if (isAdminRoute()) return false;
  const ads = adUnitsByPosition.get(position) || [];
  return ads.length > 0;
};

export const getAllAdUnits = (): AdUnit[] => {
  return adUnitsCache;
};

export const refreshAdCache = async (): Promise<void> => {
  cacheTimestamp = 0;
  await loadAdUnits();
};
