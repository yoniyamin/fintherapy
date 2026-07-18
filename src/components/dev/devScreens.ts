export type DevScreen = {
  description: string
  /** When true, route is mounted under AppShell (tab bar visible). */
  inAppShell?: boolean
  path: string
  title: string
}

/** Dev-only sandboxes — only registered when `import.meta.env.DEV`. */
export const DEV_SCREENS: DevScreen[] = [
  {
    path: '/dev/animations',
    title: 'Animation lab',
    description: 'Encouragement bursts, deck cleared screen, scroll report mockup',
  },
  {
    path: '/dev/category-picker',
    title: 'Category picker',
    description: 'Classify sandbox with SwipeCard, category picker, and editor',
    inAppShell: true,
  },
]
