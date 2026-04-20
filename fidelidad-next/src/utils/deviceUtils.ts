/**
 * UNIFIED SMART DETECTOR & PUSH STRATEGY ENGINE
 * Version 1.0 - Fidelidad-Next Unified Logic
 */

export function getDeviceContext() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isPushSupported: false, ua: 'SSR' };
  }

  const ua = navigator.userAgent || "";

  // 📱 iOS (includes iPadOS 13+ which presents as MacIntel)
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // 🍏 Specific iPhone
  const isIPhone = /iPhone/i.test(ua);

  // 📱 Samsung Internet
  const isSamsung = /SamsungBrowser\//i.test(ua);

  // 🌐 Chrome (excluding Samsung)
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
    isChrome,
    isPushSupported,
    ua
  };
}

export type PushStrategyMode = "INSTALL_REQUIRED" | "TRY_WITH_FALLBACK" | "DIRECT" | "UNSUPPORTED";

export interface PushStrategy {
  mode: PushStrategyMode;
  reason: string;
}

export function getPushStrategy(): PushStrategy {
  const ctx = getDeviceContext();

  // ❌ iOS -> Installation mandatory for Push
  if (ctx.isIOS) {
    return {
      mode: "INSTALL_REQUIRED",
      reason: "iOS requiere instalar PWA para activar notificaciones"
    };
  }

  // ⚠️ Samsung -> Try with Fallback logic
  if (ctx.isSamsung) {
    return {
      mode: "TRY_WITH_FALLBACK",
      reason: "Samsung Browser detectado (probabilidad de bloqueo silencioso)"
    };
  }

  // ❌ API not supported
  if (!ctx.isPushSupported) {
    return {
      mode: "UNSUPPORTED",
      reason: "El navegador no soporta las APIs de Notificaciones"
    };
  }

  // ✅ Optimal Case
  return {
    mode: "DIRECT",
    reason: "Soporte completo detectado"
  };
}
