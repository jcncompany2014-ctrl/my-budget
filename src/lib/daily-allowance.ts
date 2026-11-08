/**
 * "오늘 쓸 수 있는 돈" — Toss / 하루가계부-style daily allowance.
 *
 * The allowance is fixed at the START of today: what's left of the monthly
 * budget (excluding today's spending) divided evenly across the remaining days
 * including today. Spending during the day then eats into that fixed number, so
 * the figure doesn't jump around every time you log a coffee.
 *
 * Only categories that have a budget count — same scope as the home budget card.
 */
export function dailyAllowance(input: {
  budgetTotal: number;
  /** Spent this month in budgeted categories, before today. */
  spentBeforeToday: number;
  /** Spent today in budgeted categories. */
  spentToday: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1; // including today
  const remainingAtStartOfDay = input.budgetTotal - input.spentBeforeToday;
  const todayAllowance =
    remainingAtStartOfDay > 0 ? Math.floor(remainingAtStartOfDay / daysLeft) : 0;
  const todayLeft = todayAllowance - input.spentToday;
  return {
    todayAllowance,
    todayLeft,
    daysLeft,
    /** Monthly budget already exhausted before today started. */
    exhausted: remainingAtStartOfDay <= 0,
  };
}
