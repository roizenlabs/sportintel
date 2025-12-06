// Google Ads Conversion Tracking
// Account ID: AW-1012026890

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    trackSignUp?: () => void
    trackTrialStart?: () => void
    trackSubscription?: (value?: number) => void
  }
}

export const analytics = {
  // Track user registration
  trackSignUp: () => {
    if (typeof window !== 'undefined' && window.trackSignUp) {
      window.trackSignUp()
      console.log('[Analytics] Sign up conversion tracked')
    }
  },

  // Track trial start
  trackTrialStart: () => {
    if (typeof window !== 'undefined' && window.trackTrialStart) {
      window.trackTrialStart()
      console.log('[Analytics] Trial start conversion tracked')
    }
  },

  // Track subscription purchase
  trackSubscription: (value?: number) => {
    if (typeof window !== 'undefined' && window.trackSubscription) {
      window.trackSubscription(value)
      console.log('[Analytics] Subscription conversion tracked:', value)
    }
  },

  // Track custom event
  trackEvent: (eventName: string, params?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, params)
      console.log('[Analytics] Event tracked:', eventName, params)
    }
  },

  // Track page view (for SPA navigation)
  trackPageView: (path: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'AW-1012026890', {
        page_path: path
      })
    }
  }
}

export default analytics
