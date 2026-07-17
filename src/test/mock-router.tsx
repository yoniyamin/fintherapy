import { type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'

export function MockRouter({
  initialEntries = ['/'],
  children,
}: {
  initialEntries?: string[]
  children: ReactNode
}) {
  return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
}
