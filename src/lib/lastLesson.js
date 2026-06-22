// Remembers the lesson a user most recently opened, so the dashboard can show a
// "continue watching" card. Stored client-side (localStorage) keyed per user, so
// a shared device doesn't leak one student's progress into another's view. No DB
// round-trip — this is a UI convenience, the source of truth for "completed" is
// still the lesson_progress table.
const KEY = (uid) => `union:lastLesson:${uid}`

export function getLastLessonId(uid) {
  if (!uid) return null
  try {
    return localStorage.getItem(KEY(uid)) || null
  } catch {
    return null // Safari private mode / storage disabled
  }
}

export function setLastLessonId(uid, lessonId) {
  if (!uid || !lessonId) return
  try {
    localStorage.setItem(KEY(uid), lessonId)
  } catch {
    /* storage unavailable — non-fatal, card just falls back to first lesson */
  }
}
