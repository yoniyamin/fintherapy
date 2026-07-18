import type { FC } from 'react'

interface SingleUserResultProps {
  predicted: number
  actual: number
}

export const SingleUserResult: FC<SingleUserResultProps> = ({ predicted, actual }) => {
  const diff = actual - predicted
  const hasPrediction = predicted > 0
  return (
    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
      <div>
        <p className="text-[10px] text-surface-500">Predicted</p>
        <p className="mt-0.5 text-sm font-bold tabular-nums text-gem">
          {hasPrediction ? `€${predicted.toFixed(0)}` : '—'}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-surface-500">Actual</p>
        <p className="mt-0.5 text-sm font-bold tabular-nums text-ice">
          {actual > 0 ? `€${actual.toFixed(0)}` : '—'}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-surface-500">Diff</p>
        <p className={`mt-0.5 text-sm font-bold tabular-nums ${
          !hasPrediction || actual === 0 ? 'text-surface-500'
            : Math.abs(diff) < predicted * 0.1 ? 'text-duo-green'
            : diff > 0 ? 'text-danger' : 'text-flame'
        }`}>
          {hasPrediction && actual > 0
            ? `${diff > 0 ? '+' : ''}€${diff.toFixed(0)}`
            : '—'}
        </p>
      </div>
    </div>
  )
}

interface MultiMemberResultProps {
  betUserIds: string[]
  householdBetsByUser: Map<string, { displayName: string; bets: Map<string, number> }>
  categoryId: string
  actual: number
  winnerId: string | undefined
  isCurrentUser: (uid: string) => boolean
}

export const MultiMemberResult: FC<MultiMemberResultProps> = ({
  betUserIds,
  householdBetsByUser,
  categoryId,
  actual,
  winnerId,
  isCurrentUser,
}) => {
  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex items-center justify-between rounded-lg bg-surface-900/50 px-2.5 py-1.5">
        <span className="text-[11px] font-semibold text-surface-400">Actual</span>
        <span className="text-sm font-bold tabular-nums text-ice">
          {actual > 0 ? `€${actual.toFixed(0)}` : '—'}
        </span>
      </div>

      {betUserIds.map((uid) => {
        const userData = householdBetsByUser.get(uid)
        if (!userData) return null
        const predicted = userData.bets.get(categoryId)
        const hasPrediction = predicted != null && predicted > 0
        const diff = hasPrediction && actual > 0 ? actual - predicted : null
        const isWinner = winnerId === uid

        return (
          <div
            key={uid}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
              isWinner ? 'bg-duo-green/8 ring-1 ring-duo-green/20' : 'bg-white/[0.02]'
            }`}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-800 text-[10px] font-bold text-surface-300">
              {userData.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 text-[11px] text-surface-300">
              {userData.displayName}
              {isCurrentUser(uid) && (
                <span className="ml-1 text-[9px] text-surface-500">(you)</span>
              )}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${hasPrediction ? 'text-gem' : 'text-surface-600'}`}>
              {hasPrediction ? `€${predicted.toFixed(0)}` : '—'}
            </span>
            {diff !== null && predicted != null && (
              <span className={`min-w-[3.5rem] text-right text-[11px] font-semibold tabular-nums ${
                Math.abs(diff) < predicted * 0.1 ? 'text-duo-green'
                  : diff > 0 ? 'text-danger' : 'text-flame'
              }`}>
                {diff > 0 ? '+' : ''}€{diff.toFixed(0)}
              </span>
            )}
            {isWinner && <span className="text-xs">🏆</span>}
          </div>
        )
      })}
    </div>
  )
}
