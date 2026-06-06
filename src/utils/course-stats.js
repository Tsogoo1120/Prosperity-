/** Derive landing / preview stats from admin curriculum (modules) when present. */

function parseDuration(dur) {
  if (!dur) return 0
  const minMatch = String(dur).match(/(\d+(?:\.\d+)?)\s*min/i)
  if (minMatch) return parseFloat(minMatch[1]) / 60
  const parts = String(dur).split(':').map(Number)
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) return parts[0] + parts[1] / 60
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] + parts[1] / 60 + parts[2] / 3600
  }
  return 0
}

export function getLessonCount(course) {
  if (course?.modules?.length) {
    return course.modules.reduce((s, m) => s + (m.lessons?.length ?? 0), 0)
  }
  return course?.lessons ?? 0
}

export function getCourseHours(course) {
  if (course?.modules?.length) {
    const hours = course.modules
      .flatMap((m) => m.lessons ?? [])
      .reduce((s, l) => s + parseDuration(l.dur), 0)
    return Math.round(hours * 10) / 10
  }
  return course?.hours ?? 0
}

/** Flat lesson rows for preview (titles only — no video URLs exposed). */
export function getCurriculumPreview(course) {
  if (!course?.modules?.length) return []
  return course.modules.flatMap((m) =>
    (m.lessons ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      type: l.type,
      dur: l.dur,
      moduleTitle: m.title,
    })),
  )
}
