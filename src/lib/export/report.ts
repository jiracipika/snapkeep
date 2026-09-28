import { strToU8 } from 'fflate'
import type { ExportPlan, PlanOptions } from '@/lib/snapchat/plan'
import type { ArchiveSession } from '@/lib/snapchat/session'

/**
 * snapchat-export-report.json — an optional Advanced Mode export companion.
 * Privacy: only counts, paths, and date provenance. Captions and GPS
 * coordinates are excluded unless explicitly enabled.
 */

export interface ReportOptions extends PlanOptions {
  includeLocations?: boolean
}

export function buildExportReport(
  plan: ExportPlan,
  session: ArchiveSession,
  options: ReportOptions,
): Uint8Array {
  const report = {
    tool: 'snapkeep',
    generatedAt: new Date().toISOString(),
    sourceArchives: session.sources.map((s) => ({ name: s.name, bytes: s.size })),
    layout: session.result.layout,
    options: {
      rootName: options.rootName,
      folderStrategy: options.folderStrategy,
      filenameTemplate: options.filenameTemplate,
      includeOverlays: options.includeOverlays,
      includeSplitSegments: options.includeSplitSegments,
    },
    stats: plan.stats,
    collisions: plan.collisions,
    files: plan.entries.map((entry) => ({
      source: entry.item.entryName,
      destination: entry.path,
      mediaType: entry.item.kind,
      bytes: entry.item.size,
      date: entry.item.timestampMs !== null ? new Date(entry.item.timestampMs).toISOString() : null,
      timestampSource: entry.item.timestampSource,
      confidence: entry.item.confidence,
      splitGroup: entry.item.splitGroup,
      ...(options.includeLocations && entry.item.lat !== null
        ? { lat: entry.item.lat, lon: entry.item.lon }
        : {}),
    })),
    failures: plan.skipped.map((item) => ({ source: item.entryName, reason: 'excluded by options' })),
  }
  return strToU8(JSON.stringify(report, null, 2))
}
