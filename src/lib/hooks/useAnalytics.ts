import { usePostHog } from 'posthog-js/react'
import { analytics } from '@/lib/analytics'

export function useAnalytics() {
  const posthog = usePostHog()

  return {
    track: analytics.track.bind(analytics),
    trackRoomEvent: analytics.trackRoomEvent.bind(analytics),
    trackBracketPick: analytics.trackBracketPick.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    trackPerformance: analytics.trackPerformance.bind(analytics),
    startTimer: analytics.startTimer.bind(analytics),
    getFeatureFlag: analytics.getFeatureFlag.bind(analytics),
    posthog, // Direct access if needed
  }
} 