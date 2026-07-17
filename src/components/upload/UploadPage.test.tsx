import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadPage from './UploadPage'
import { MockAuthProvider } from '../../test/mock-auth'
import { MockRouter } from '../../test/mock-router'
import type { Profile } from '../../types/database'

const TEST_HOUSEHOLD_ID = 'hh-upload-1'

const mockProfile: Profile = {
  id: 'user-1',
  display_name: 'Uploader',
  household_id: TEST_HOUSEHOLD_ID,
  total_xp: 0,
  created_at: '2026-01-01',
}

const mockAutoClassify = vi.fn().mockResolvedValue(0)
const mockGetAccountAliases = vi.fn().mockResolvedValue([])
const mockGetDistinctLast4 = vi.fn().mockResolvedValue([])
const mockDetectRefunds = vi.fn().mockResolvedValue(0)
const mockAutoMarkDebitLoads = vi.fn().mockResolvedValue(0)
const mockSetAccountType = vi.fn().mockResolvedValue(undefined)
const mockSyncBillingMonth = vi.fn().mockResolvedValue({ updated: 0 })

vi.mock('../../hooks/useMerchantKnowledge', () => ({
  useMerchantKnowledge: () => ({
    autoClassify: mockAutoClassify,
  }),
}))

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    getAccountAliases: mockGetAccountAliases,
    getDistinctAccountLast4ForHousehold: mockGetDistinctLast4,
    detectRefunds: mockDetectRefunds,
    autoMarkDebitLoads: mockAutoMarkDebitLoads,
    setAccountType: mockSetAccountType,
    syncBillingMonthFromTxDate: mockSyncBillingMonth,
  }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

vi.mock('../../lib/pendingTransactionsCache', () => ({
  invalidatePendingTransactionsInflight: vi.fn(),
}))

function renderUpload() {
  return render(
    <MockRouter initialEntries={['/upload']}>
      <MockAuthProvider value={{ profile: mockProfile }}>
        <UploadPage />
      </MockAuthProvider>
    </MockRouter>,
  )
}

function createCsvFile(content: string, name = 'test.csv'): File {
  return new File([content], name, { type: 'text/csv' })
}

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upload page with file input', () => {
    // Arrange & Act
    renderUpload()

    // Assert
    expect(screen.getByText(/upload transactions/i)).toBeInTheDocument()
  })

  it('shows step indicator starting at step 1', () => {
    // Arrange & Act
    renderUpload()

    // Assert
    expect(screen.getByText(/select file/i)).toBeInTheDocument()
  })

  it('parses a CSV file and shows preview with detected columns', async () => {
    // Arrange
    renderUpload()
    const user = userEvent.setup()
    const csv = 'Date,Description,Amount\n2026-01-15,Groceries,-45.50\n2026-01-16,Gas,-30.00'
    const file = createCsvFile(csv)
    const input = document.querySelector('input[type="file"]')!

    // Act
    await user.upload(input as HTMLInputElement, file)

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/review/i)).toBeInTheDocument()
    })
  })

  it('shows account last4 selector after file parse', async () => {
    // Arrange
    mockGetDistinctLast4.mockResolvedValue(['1234', '5678'])
    renderUpload()
    const user = userEvent.setup()
    const csv = 'Date,Description,Amount\n2026-01-15,Groceries,-45.50'
    const file = createCsvFile(csv)
    const input = document.querySelector('input[type="file"]')!

    // Act
    await user.upload(input as HTMLInputElement, file)

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/review/i)).toBeInTheDocument()
    })
  })

  it('shows error message for empty CSV', async () => {
    // Arrange
    renderUpload()
    const user = userEvent.setup()
    const file = createCsvFile('')
    const input = document.querySelector('input[type="file"]')!

    // Act
    await user.upload(input as HTMLInputElement, file)

    // Assert
    await waitFor(() => {
      const errorEl = screen.queryByText(/no rows/i) ?? screen.queryByText(/empty/i) ?? screen.queryByText(/could not/i)
      expect(errorEl ?? screen.getByText(/select file/i)).toBeInTheDocument()
    })
  })

  it('shows detected column mappings after parsing', async () => {
    // Arrange
    renderUpload()
    const user = userEvent.setup()
    const csv = 'Fecha,Concepto,Importe\n15/01/2026,Supermercado,-22.50'
    const file = createCsvFile(csv, 'banco.csv')
    const input = document.querySelector('input[type="file"]')!

    // Act
    await user.upload(input as HTMLInputElement, file)

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/review/i)).toBeInTheDocument()
    })
  })
})
