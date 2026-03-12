/**
 * FitQuest App Theme Colors
 * These colors match the NativeWind configuration in tailwind.config.js
 */

import { Platform } from 'react-native';

// Brand Colors
export const BrandColors = {
  primary: '#A556FB',
  secondary: '#4922E5',
  dark: '#020202',
  white: '#FFFFFF',
  black: '#000000',
};

// Functional Colors
const tintColorLight = BrandColors.primary;
const tintColorDark = BrandColors.white;

export const Colors = {
  light: {
    text: BrandColors.dark,
    background: BrandColors.white,
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    border: '#E5E5E5',
    card: BrandColors.white,
  },
  dark: {
    text: BrandColors.white,
    background: BrandColors.dark,
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    border: '#333333',
    card: '#1A1A1A',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
