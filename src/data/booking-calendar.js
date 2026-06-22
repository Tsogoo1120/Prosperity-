/** Shared day/slot options for landing booking UI and enroll flow */
function nextWeekdays() {
  const days = []
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const d = new Date()
  d.setDate(d.getDate() + 1)
  while (days.length < 10) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      days.push({ d: dayNames[dow], n: d.getDate(), iso: d.toISOString().split('T')[0], unavail: false })
    }
    d.setDate(d.getDate() + 1)
  }
  return days
}

const calDays = nextWeekdays()

const calSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
]

export function formatBookingSummary(bookDate, bookSlot) {
  if (!bookDate || !bookSlot) return null
  return `${bookDate.d} ${bookDate.n} · ${bookSlot}`
}
