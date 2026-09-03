import { useState, type ComponentProps } from 'react'
import { motion } from 'framer-motion'
import EmilCompareFrame from './EmilCompareFrame'
import type { ImagegenMobileSuggestion } from './imagegenMobileImprovementSuggestions'
import { toCompareSuggestion } from './motionLabShared'
import type { EmilSuggestion } from './emilImprovementSuggestions'
import {
  CrampedStatsScreen,
  FlatOffBrandScreen,
  GenericFintechScreen,
  PillSpamScreen,
  SpentWhattClassifyScreen,
  SpentWhattHomeScreen,
  SpentWhattMiniPhone,
  SpentWhattRevealScreen,
  UnsafeAreaScreen,
} from './spentWhattPhoneMocks'
import { ui } from '../../lib/uiClasses'

interface DemoProps {
  replayKey: number
  suggestion: ImagegenMobileSuggestion
  onReplay: () => void
}

function ImagegenCompareFrame(
  props: Omit<ComponentProps<typeof EmilCompareFrame>, 'suggestion'> & { suggestion: EmilSuggestion },
) {
  return <EmilCompareFrame {...props} afterLabel="After (SpentWhatt)" />
}

function asEmilSuggestion(s: ImagegenMobileSuggestion): EmilSuggestion {
  return toCompareSuggestion(s)
}

export function ImagegenMobileSuggestionDemo({
  id,
  replayKey,
  suggestion,
  onReplay,
}: DemoProps & { id: string }) {
  const frame = asEmilSuggestion(suggestion)

  switch (id) {
    case 'fintech-hierarchy':
      return <FintechHierarchyDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'pill-spam-classify':
      return <PillSpamDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'safe-area-insets':
      return <SafeAreaDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'texture-atmosphere':
      return <TextureDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'visual-density':
      return <DensityDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    default:
      return null
  }
}

function FintechHierarchyDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  return (
    <ImagegenCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <SpentWhattMiniPhone key={`fintech-before-${replayKey}`}>
          <GenericFintechScreen />
        </SpentWhattMiniPhone>
      }
      after={
        <SpentWhattMiniPhone key={`fintech-after-${replayKey}`}>
          <SpentWhattClassifyScreen />
        </SpentWhattMiniPhone>
      }
    />
  )
}

function PillSpamDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  return (
    <ImagegenCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <SpentWhattMiniPhone key={`pill-before-${replayKey}`}>
          <PillSpamScreen />
        </SpentWhattMiniPhone>
      }
      after={
        <SpentWhattMiniPhone key={`pill-after-${replayKey}`}>
          <SpentWhattClassifyScreen />
        </SpentWhattMiniPhone>
      }
    />
  )
}

function SafeAreaDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  const [showGuides, setShowGuides] = useState(true)

  return (
    <ImagegenCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setShowGuides(true)
      }}
      before={
        <SpentWhattMiniPhone key={`safe-before-${replayKey}`}>
          <UnsafeAreaScreen />
        </SpentWhattMiniPhone>
      }
      after={
        <SpentWhattMiniPhone key={`safe-after-${replayKey}`}>
          <button
            type="button"
            onClick={() => setShowGuides((v) => !v)}
            className="relative flex h-full w-full flex-col"
          >
            {showGuides && (
              <>
                <div className="absolute inset-x-0 top-0 z-20 h-[12%] border-b border-dashed border-ice/30 bg-ice/5" />
                <div className="absolute inset-x-0 bottom-0 z-20 h-[16%] border-t border-dashed border-ice/30 bg-ice/5" />
              </>
            )}
            <SpentWhattClassifyScreen />
            <p className="absolute bottom-0.5 left-0 right-0 z-30 text-center text-[4px] text-surface-600">
              {showGuides ? 'Tap to hide safe-area guides' : 'Tap to show guides'}
            </p>
          </button>
        </SpentWhattMiniPhone>
      }
    />
  )
}

function TextureDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  return (
    <ImagegenCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <SpentWhattMiniPhone key={`tex-before-${replayKey}`}>
          <FlatOffBrandScreen />
        </SpentWhattMiniPhone>
      }
      after={
        <SpentWhattMiniPhone key={`tex-after-${replayKey}`}>
          <SpentWhattRevealScreen />
        </SpentWhattMiniPhone>
      }
    />
  )
}

function DensityDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <ImagegenCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setExpanded(false)
      }}
      before={
        <SpentWhattMiniPhone key={`density-before-${replayKey}`}>
          <CrampedStatsScreen />
        </SpentWhattMiniPhone>
      }
      after={
        <SpentWhattMiniPhone key={`density-after-${replayKey}`}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="relative flex h-full w-full flex-col text-left"
          >
            <SpentWhattHomeScreen />
            {expanded && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`absolute inset-x-2 bottom-[20%] ${ui.glassInset} p-2`}
              >
                <p className="text-[6px] text-surface-400">12 classified today</p>
              </motion.div>
            )}
            <p className="absolute bottom-1 left-0 right-0 text-center text-[4px] text-surface-600">
              {expanded ? 'Tap to collapse' : 'Tap to expand — density 3 spacing'}
            </p>
          </button>
        </SpentWhattMiniPhone>
      }
    />
  )
}
