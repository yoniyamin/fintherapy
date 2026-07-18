import type { FC } from 'react'
import type { NavIconProps } from './navIcons'
import {
  AnalysisIcon,
  AnalysisIconFilled,
  BetsIcon,
  BetsIconFilled,
  HomeIcon,
  HomeIconFilled,
  RevealIcon,
  RevealIconFilled,
  SettingsIcon,
  SettingsIconFilled,
  SwipeIcon,
  SwipeIconFilled,
  UploadIcon,
  UploadIconFilled,
} from './navIcons'

export interface NavItemDef {
  to: string
  label: string
  icon: FC<NavIconProps>
  activeIcon: FC<NavIconProps>
  end?: boolean
}

export const allNavItems: NavItemDef[] = [
  { to: '/', label: 'Home', icon: HomeIcon, activeIcon: HomeIconFilled },
  { to: '/classify', label: 'Classify', icon: SwipeIcon, activeIcon: SwipeIconFilled, end: false },
  { to: '/reveal', label: 'Reveal', icon: RevealIcon, activeIcon: RevealIconFilled },
  { to: '/analysis', label: 'Analysis', icon: AnalysisIcon, activeIcon: AnalysisIconFilled },
  { to: '/bets', label: 'Bets', icon: BetsIcon, activeIcon: BetsIconFilled },
]

export const desktopNavItems: NavItemDef[] = allNavItems.filter(item => item.to !== '/')

export const desktopSecondaryItems: NavItemDef[] = [
  { to: '/upload', label: 'Upload', icon: UploadIcon, activeIcon: UploadIconFilled },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, activeIcon: SettingsIconFilled },
]
