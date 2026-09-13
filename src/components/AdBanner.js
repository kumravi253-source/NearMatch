import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { getBannerUnitId, loadGoogleMobileAds } from '../lib/ads';
import { COLORS } from '../theme/theme';

export default function AdBanner() {
  const [visible, setVisible] = useState(true);
  const ads = loadGoogleMobileAds();
  const unitId = getBannerUnitId();

  if (!visible || !ads || !unitId) return null;

  const { BannerAd, BannerAdSize } = ads;

  return (
    <View style={styles.slot}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={(error) => {
          console.error('Banner ad failed to load', error);
          setVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.coralBorder,
    paddingVertical: 4,
  },
});
