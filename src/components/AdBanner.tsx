import React, { useEffect, useState } from 'react';
import { getAdsByPosition, loadAdUnits } from '../lib/ads';

interface AdBannerProps {
  position: string;
  className?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({ position, className = '' }) => {
  const [adUnits, setAdUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAds = async () => {
      await loadAdUnits();
      const ads = getAdsByPosition(position);
      setAdUnits(ads);
      setIsLoading(false);
    };

    loadAds();
  }, [position]);

  if (isLoading || adUnits.length === 0) {
    return null;
  }

  return (
    <div className={`ad-banner-container ${className}`}>
      {adUnits.map((ad) => (
        <div
          key={ad.id}
          className="ad-unit"
          dangerouslySetInnerHTML={{ __html: ad.ad_code }}
        />
      ))}
    </div>
  );
};

export default AdBanner;
