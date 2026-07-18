import { useCallback, useMemo } from 'react'
import { useDragControls, type PanInfo } from 'framer-motion'

export const BOTTOM_SHEET_DISMISS_OFFSET_Y = 80
export const BOTTOM_SHEET_DISMISS_VELOCITY_Y = 480

export const BOTTOM_SHEET_HANDLE_CLASS =
  'cursor-grab select-none active:cursor-grabbing'

/**
 * Drag-to-dismiss props for bottom sheets. Attach `sheetDragProps` to the sheet
 * `motion.div` and spread `handleZoneProps(className?)` on the handle/header strip.
 */
export function useBottomSheetDrag(onClose: () => void) {
  const dragControls = useDragControls()

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (
        info.offset.y > BOTTOM_SHEET_DISMISS_OFFSET_Y ||
        info.velocity.y > BOTTOM_SHEET_DISMISS_VELOCITY_Y
      ) {
        onClose()
      }
    },
    [onClose],
  )

  const sheetDragProps = useMemo(
    () => ({
      drag: 'y' as const,
      dragControls,
      dragListener: false,
      dragConstraints: { top: 0, left: 0, right: 0, bottom: 0 },
      dragElastic: 0.22,
      dragMomentum: false,
      onDragEnd,
    }),
    [dragControls, onDragEnd],
  )

  const handleZoneProps = useCallback(
    (className?: string) => ({
      className: className
        ? `${className} ${BOTTOM_SHEET_HANDLE_CLASS}`
        : BOTTOM_SHEET_HANDLE_CLASS,
      style: { touchAction: 'none' as const },
      onPointerDown: (e: React.PointerEvent) => dragControls.start(e),
    }),
    [dragControls],
  )

  return { sheetDragProps, handleZoneProps, dragControls }
}
