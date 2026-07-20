import type { SVGProps } from 'react'
import { ICON_PATHS, type IconName } from './analysisIconPaths'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'dangerouslySetInnerHTML'>

/** Renders an SVG icon by name. Stable component identity — safe during render. */
export default function AnalysisIcon({ name, ...rest }: { name: IconName } & IconProps) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  )
}
