/**
 * UNIFIED SMART DETECTOR & PUSH STRATEGY ENGINE
 * Version 1.2 - Ultra Robust & Multi-Layer Detection
 */

export function getDeviceContext() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isPushSupported: false, ua: 'SSR' };
  }

  const ua = navigator.userAgent || "";
  const vendor = navigator.vendor || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // 🍏 iOS / Apple (Multi-check)
  const isApple = /Apple/i.test(vendor);
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (platform === "MacIntel" && maxTouchPoints > 1) ||
    isApple && /Mobile/i.test(ua);

  // 📱 Samsung Internet (Ultra Robust)
  // Check for SamsungBrowser string OR Samsung vendor + Android
  const isSamsung = 
    /SamsungBrowser/i.test(ua) || 
    (/Samsung/i.test(vendor) && /Android/i.test(ua)) ||
    (/SAMSUNG/i.test(ua) && /Chrome/i.test(ua));

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
    isSamsung,
    samsungVersion,
    isChrome,
    isPushSupported,
    ua,
    vendor,
    platform,
    maxTouchPoints
  };
}

export type PushStrategyMode = "INSTALL_REQUIRED" | "TRY_WITH_FALLBACK" | "DIRECT" | "UNSUPPORTED";

export function getPushStrategy() {
  const ctx = getDeviceContext();

  if (ctx.isIOS) {
    return {
      mode: "INSTALL_REQUIRED" as const,
      reason: "iOS detectado (Requiere instalación)"
    };
  }

  if (ctx.isSamsung) {
    return {
      mode: "TRY_WITH_FALLBACK" as const,
      reason: `Samsung Internet ${ctx.samsungVersion || ''} detectado`
    };
  }

  if (!ctx.isPushSupported) {
    return {
      mode: "UNSUPPORTED" as const,
      reason: "Navegador sin soporte de API Push"
    };
  }

  return {
    mode: "DIRECT" as const,
    reason: "Browser compatible (Chrome/Android)"
  };
}
