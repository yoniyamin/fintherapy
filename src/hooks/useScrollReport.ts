import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { HEADER_SCROLL_SHADOW_PX, type ScrollReportSectionDef } from '../lib/scrollReportMotion'

interface UseScrollReportResult {
  scrollRef: RefObject<HTMLDivElement | null>
  headerRef: RefObject<HTMLElement | null>
  activeId: string
  activeSection: ScrollReportSectionDef
  activeIndex: number
  navShadow: boolean
  scrollProgress: number
  reportComplete: boolean
  scrollToSection: (id: string) => void
  scrollToTop: () => void
}

/** Tracks scroll progress, active section, and smooth anchor navigation for scroll reports. */
export function useScrollReport(sections: readonly ScrollReportSectionDef[]): UseScrollReportResult {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const [navShadow, setNavShadow] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  const activeSection = sections.find((section) => section.id === activeId) ?? sections[0]
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeId))
  const reportComplete = scrollProgress >= 98

  /** Updates nav shadow and scroll progress from the report scroll container. */
  const handleScroll = useCallback(() => {
    const root = scrollRef.current
    if (!root) return

    setNavShadow(root.scrollTop > HEADER_SCROLL_SHADOW_PX)
    const maxScroll = root.scrollHeight - root.clientHeight
    setScrollProgress(maxScroll > 0 ? (root.scrollTop / maxScroll) * 100 : 0)
  }, [])

  /** Smooth-scrolls the report container to a section anchor. */
  const scrollToSection = useCallback((id: string) => {
    const root = scrollRef.current
    const section = document.getElementById(id)
    if (!root || !section) return

    const headerHeight = headerRef.current?.offsetHeight ?? 56
    root.scrollTo({
      top: section.offsetTop - headerHeight,
      behavior: 'smooth',
    })
  }, [])

  /** Smooth-scrolls back to the first report section. */
  const scrollToTop = useCallback(() => {
    const firstId = sections[0]?.id
    if (firstId) scrollToSection(firstId)
  }, [scrollToSection, sections])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    handleScroll()
    root.addEventListener('scroll', handleScroll, { passive: true })
    return () => root.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || sections.length === 0) return

    const sectionElements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element != null)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        const topEntry = visible[0]
        if (topEntry?.target.id) {
          setActiveId(topEntry.target.id)
        }
      },
      {
        root,
        threshold: [0.15, 0.35, 0.55],
        rootMargin: '-12% 0px -55% 0px',
      },
    )

    sectionElements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [sections])

  return {
    scrollRef,
    headerRef,
    activeId,
    activeSection,
    activeIndex,
    navShadow,
    scrollProgress,
    reportComplete,
    scrollToSection,
    scrollToTop,
  }
}
