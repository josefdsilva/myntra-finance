/**
 * Small typed helpers shared across route/query code.
 * Keep this file dependency-free (no React, no Supabase) so it can be imported
 * from server functions and components alike.
 */

/**
 * Normalise a Supabase-style query result into an array.
 * Supabase returns `T[] | null` on error paths; consumers almost always want
 * an empty array to iterate over. Using this helper avoids re-typing `?? []`
 * with an explicit cast at every call site.
 */
export function rowsOrEmpty<T>(rows: readonly T[] | T[] | null | undefined): T[] {
  return rows ? (rows as T[]) : [];
}
