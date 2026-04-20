/**
 * UNIFIED SMART DETECTOR & PUSH STRATEGY ENGINE
 * Version 1.1 - Enhanced Samsung & iPadOS Detection
 */

export function getDeviceContext() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isPushSupported: false, ua: 'SSR' };
  }

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // 📱 iOS (Strict & iPadOS 13+ support)
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (platform === "MacIntel" && maxTouchPoints > 1);

  // 🍏 Specific iPhone
  const isIPhone = /iPhone/i.test(ua);

  // 📱 Samsung Internet (More robust versioning)
  // UA examples: "SamsungBrowser/29.0", "SamsungBrowser/20.0"
  const isSamsung = /SamsungBrowser/i.test(ua);
  const samsungMatch = ua.match(/SamsungBrowser\/(\d+)/i);
  const samsungVersion = samsungMatch ? parseInt(samsungMatch[1], 10) : null;

  // 🌐 Chrome (standard)
  const isChrome = /Chrome/i.test(ua) && !isSamsung;

  // ⚙️ Real API Support
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;

  const isPushSupported =
    hasServiceWorker &&
    hasPushManager &&
    hasNotification;

  return {
    isIOS,
    isIPhone,
    isSamsung,
    samsungVersion,
    isChrome,
    isPushSupported,
    ua,
    platform,
    maxTouchPoints
  };
}

export type PushStrategyMode = "INSTALL_REQUIRED" | "TRY_WITH_FALLBACK" | "DIRECT" | "UNSUPPORTED";

export interface PushStrategy {
  mode: PushStrategyMode;
  reason: string;
}

export function getPushStrategy(): PushStrategy {
  const ctx = getDeviceContext();

  if (ctx.isIOS) {
    return {
      mode: "INSTALL_REQUIRED",
      reason: "iOS requiere instalación para Push"
    };
  }

  if (ctx.isSamsung) {
    return {
      mode: "TRY_WITH_FALLBACK",
      reason: `Samsung Internet v${ctx.samsungVersion || '?'}`
    };
  }

  if (!ctx.isPushSupported) {
    return {
      mode: "UNSUPPORTED",
      reason: "API Not Supported"
    };
  }

  return {
    mode: "DIRECT",
    reason: "Soporte completo detectado"
  };
}
