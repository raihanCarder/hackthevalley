import type { Pool, PoolClient } from "pg";
import { parseLocalDate, type DailyEntry, type LocalDate } from "../domain/contracts";
import { checkRead, JournalError, parseStoredEntry, prepareEntry, requireSynthetic, validateRange,
  type CheckInInput, type DateRange, type EntrySummary, type JournalMapServices,
  type JournalProfile, type JournalRepository, type ReadOptions, type SyntheticJournalSource,
} from "./repository";

// One SELECT includes observations, so readers cannot observe half a replacement.
const metadataColumns = `e.id, e.profile_id AS "profileId", to_char(e.local_date, 'YYYY-MM-DD') AS "localDate",
  e.time_zone AS "timeZone", e.updated_at AS "updatedAt", e.schema_version AS "schemaVersion",
  e.body_map_version AS "bodyMapVersion",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('regionId', r.region_id, 'painType', r.pain_type,
    'meanIntensity', r.mean_intensity, 'peakIntensity', r.peak_intensity, 'mapCoverage', r.map_coverage)
    ORDER BY r.region_id, r.pain_type) FROM regional_observations r WHERE r.entry_id = e.id), '[]'::jsonb) AS observations`;

function normalize(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, updatedAt: (row.updatedAt as Date).toISOString(), note: row.note ?? undefined };
}

export class PostgresJournal implements JournalRepository {
  readonly storage = "postgresql" as const;
  constructor(private readonly pool: Pool, private readonly profileId: string,
    private readonly maps: JournalMapServices | null,
    private readonly synthetic: SyntheticJournalSource | null = null) {}

  async list(profile: JournalProfile, range: DateRange, options?: ReadOptions): Promise<EntrySummary[]> {
    validateRange(range); checkRead(options);
    if (profile === "maya") return structuredClone(await requireSynthetic(this.synthetic).list("maya", range, options));
    try {
      const { rows } = await this.pool.query(`SELECT ${metadataColumns} FROM daily_entries e
        WHERE e.profile_id = $1 AND e.local_date BETWEEN $2::date AND $3::date ORDER BY e.local_date`, [this.profileId, range.from, range.to]);
      checkRead(options);
      return rows.map(row => {
        const normalized = normalize(row);
        delete normalized.note;
        return normalized as unknown as EntrySummary;
      });
    } catch (error) { throw this.readError(error); }
  }

  async read(profile: JournalProfile, date: LocalDate, options?: ReadOptions): Promise<DailyEntry | null> {
    parseLocalDate(date); checkRead(options);
    if (profile === "maya") return structuredClone(await requireSynthetic(this.synthetic).read("maya", date, options));
    return this.selectOne("e.local_date = $2::date", date, options);
  }

  async previous(profile: JournalProfile, before: LocalDate, options?: ReadOptions): Promise<DailyEntry | null> {
    parseLocalDate(before); checkRead(options);
    if (profile === "maya") return structuredClone(await requireSynthetic(this.synthetic).previous("maya", before, options));
    return this.selectOne("e.local_date < $2::date", before, options);
  }

  private async selectOne(condition: string, date: LocalDate, options?: ReadOptions): Promise<DailyEntry | null> {
    try {
      const { rows } = await this.pool.query(`SELECT ${metadataColumns}, e.maps, e.note FROM daily_entries e
        WHERE e.profile_id = $1 AND ${condition} ORDER BY e.local_date DESC LIMIT 1`, [this.profileId, date]);
      checkRead(options);
      return rows[0] ? parseStoredEntry(normalize(rows[0])) : null;
    } catch (error) { throw this.readError(error); }
  }

  private readError(error: unknown): JournalError {
    return error instanceof JournalError ? error : new JournalError("unavailable", "PostgreSQL could not read the journal. The selected store has not changed.");
  }

  async upsert(input: CheckInInput): Promise<DailyEntry> {
    const prepared = await prepareEntry(input, this.profileId, this.maps);
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");
      const { rows } = await client.query(`INSERT INTO daily_entries
        (id, profile_id, local_date, time_zone, schema_version, body_map_version, maps, note)
        VALUES ($1,$2,$3::date,$4,$5,$6,$7::jsonb,$8)
        ON CONFLICT (profile_id, local_date) DO UPDATE SET time_zone = EXCLUDED.time_zone,
          updated_at = clock_timestamp(), maps = EXCLUDED.maps, note = EXCLUDED.note,
          schema_version = EXCLUDED.schema_version, body_map_version = EXCLUDED.body_map_version
        RETURNING id, updated_at`, [prepared.id, this.profileId, prepared.localDate,
        prepared.timeZone, prepared.schemaVersion, prepared.bodyMapVersion, JSON.stringify(prepared.maps), prepared.note ?? null]);
      const id: string = rows[0].id;
      await client.query("DELETE FROM regional_observations WHERE entry_id = $1", [id]);
      for (const row of prepared.observations) {
        await client.query(`INSERT INTO regional_observations
          (entry_id, region_id, pain_type, mean_intensity, peak_intensity, map_coverage)
          VALUES ($1,$2,$3,$4,$5,$6)`, [id, row.regionId, row.painType, row.meanIntensity, row.peakIntensity, row.mapCoverage]);
      }
      await client.query("COMMIT");
      return { ...prepared, id, updatedAt: (rows[0].updated_at as Date).toISOString() };
    } catch {
      if (client) { try { await client.query("ROLLBACK"); } catch { /* Keep the original failure private. */ } }
      throw new JournalError("unavailable", "PostgreSQL rejected the save. Your draft has not been saved.");
    } finally { client?.release(); }
  }
}
