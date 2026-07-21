export function parseDuration(durationStr) {
  if (!durationStr) return { days: 30, isLifelong: false };
  
  const str = durationStr.toLowerCase().trim();
  if (str.includes("lifelong") || str.includes("always")) {
    return { days: null, isLifelong: true };
  }

  const match = str.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (str.includes("week")) return { days: num * 7, isLifelong: false };
    if (str.includes("month")) return { days: num * 30, isLifelong: false };
    if (str.includes("year")) return { days: num * 365, isLifelong: false };
    return { days: num, isLifelong: false }; // Assume days if no unit
  }

  return { days: 30, isLifelong: false }; // Fallback
}

export function parseFrequency(freqStr) {
  if (!freqStr) return 1;

  const str = freqStr.toLowerCase().trim();
  
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  
  if (str.includes("once") || str === "daily" || str.includes("1 time") || str.includes("1x")) return 1;
  if (str.includes("twice") || str.includes("2 time") || str.includes("2x")) return 2;
  if (str.includes("three times") || str.includes("3 time") || str.includes("3x")) return 3;
  if (str.includes("four times") || str.includes("4 time") || str.includes("4x")) return 4;
  if (str.includes("five times") || str.includes("5 time") || str.includes("5x")) return 5;
  
  // Every X hours
  if (str.includes("every 24 hour")) return 1;
  if (str.includes("every 12 hour")) return 2;
  if (str.includes("every 8 hour")) return 3;
  if (str.includes("every 6 hour")) return 4;
  if (str.includes("every 4 hour")) return 6;
  if (str.includes("every 3 hour")) return 8;

  const timesMatch = str.match(/(\d+)\s*(?:times?|x)\s*(?:a\s*)?(?:day|daily)?/);
  if (timesMatch) return parseInt(timesMatch[1], 10);

  const hourMatch = str.match(/every\s*(\d+)\s*hour/);
  if (hourMatch) {
    const num = parseInt(hourMatch[1], 10);
    if (num > 0) return Math.floor(24 / num);
  }

  // Generic match for number
  const numMatch = str.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);

  return 1; // Fallback
}

export function generateScheduledDoses(startDate, durationInfo, frequencyPerDay) {
    const doses = [];
    const start = new Date(startDate);
    start.setHours(8, 0, 0, 0); // Start at 8 AM by default

    // If lifelong, we might just generate for the next 30 days to avoid infinite loops, 
    // or calculate adherence up to "today".
    // Actually, we shouldn't pre-generate infinite doses in DB. 
    // This helper will just be used to calculate expected doses up to `targetDate`.
    return doses; // Not used currently, we calculate dynamically.
}
