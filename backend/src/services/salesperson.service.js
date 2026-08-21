const prisma = require('../lib/prisma');
const { CUTOFF_DATE } = require('../lib/callsCutoff');

const RECENT_ITEMS_LIMIT = 8; // dedupe recent calls' points rather than a full
// frequency count — reasonable for the current single-salesperson MVP scale.

function average(values) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function dedupeRecent(items, limit) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

async function getSummary() {
  const salesperson = await prisma.salesperson.findFirst({ where: { active: true } });

  const analyses = await prisma.callAnalysis.findMany({
    where: { call: { startedAt: { gte: CUTOFF_DATE } } },
    include: { mistakes: true, recommendations: true },
    orderBy: { createdAt: 'desc' },
  });

  if (analyses.length === 0) {
    return {
      salesperson: salesperson ? { name: salesperson.name } : null,
      analyzedCallsCount: 0,
      overallScore: null,
      skills: {
        communication: null,
        needDiscovery: null,
        productPresentation: null,
        objectionHandling: null,
        closing: null,
      },
      strengths: [],
      mistakes: [],
      recommendations: [],
    };
  }

  const strengths = dedupeRecent(
    analyses.flatMap((a) => (Array.isArray(a.strengths) ? a.strengths : [])),
    RECENT_ITEMS_LIMIT
  );

  const mistakes = dedupeRecent(
    analyses.flatMap((a) => a.mistakes.map((m) => `${m.category}: ${m.description}`)),
    RECENT_ITEMS_LIMIT
  );

  const recommendations = dedupeRecent(
    analyses.flatMap((a) => a.recommendations.map((r) => r.whatToDo)),
    RECENT_ITEMS_LIMIT
  );

  return {
    salesperson: salesperson ? { name: salesperson.name } : null,
    analyzedCallsCount: analyses.length,
    overallScore: average(analyses.map((a) => a.overallScore)),
    skills: {
      communication: average(analyses.map((a) => a.communication)),
      needDiscovery: average(analyses.map((a) => a.needDiscovery)),
      productPresentation: average(analyses.map((a) => a.productPresentation)),
      objectionHandling: average(analyses.map((a) => a.objectionHandling)),
      closing: average(analyses.map((a) => a.closing)),
    },
    strengths,
    mistakes,
    recommendations,
  };
}

module.exports = { getSummary };
