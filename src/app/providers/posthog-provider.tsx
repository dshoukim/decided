'use client';

import posthog, { PostHog } from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { useUser } from '@/lib/hooks/useUser';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    loaded: (posthog: PostHog) => {
      if (process.env.NODE_ENV === 'development') posthog.debug();
    },
    capture_pageview: false, // We'll manually track page views
    capture_pageleave: true,
  });
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.full_name,
        avatar_url: user.user_metadata?.avatar_url,
      });
    } else {
      posthog.reset();
    }
  }, [user]);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
} 