import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { TournamentEngine } from '@/lib/tournament-engine'
import { HealthChecker } from '@/lib/monitoring/tournament-metrics'

export async function GET() {
  const checks = {
    database: false,
    tournament_engine: false,
    elo_processing: false,
  };
  
  const startTime = Date.now();
  
  try {
    // Database connectivity test
    await db.execute(sql`SELECT 1`);
    checks.database = true;
    HealthChecker.setCheck('database', true);
  } catch (error) {
    console.error('Database health check failed:', error);
    HealthChecker.setCheck('database', false);
  }
  
  try {
    // Tournament engine test
    const testTournament = await TournamentEngine.generateMockTournament();
    checks.tournament_engine = testTournament.matches.length > 0;
    HealthChecker.setCheck('tournament_engine', checks.tournament_engine);
  } catch (error) {
    console.error('Tournament engine health check failed:', error);
    HealthChecker.setCheck('tournament_engine', false);
  }
  
  try {
    // ELO processing test (basic functionality)
    checks.elo_processing = true; // Placeholder - implement actual ELO queue size check
    HealthChecker.setCheck('elo_processing', true);
  } catch (error) {
    console.error('ELO processing health check failed:', error);
    HealthChecker.setCheck('elo_processing', false);
  }
  
  const healthy = Object.values(checks).every(v => v);
  const responseTime = Date.now() - startTime;
  
  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'unhealthy',
      checks,
      responseTime,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
    },
    { status: healthy ? 200 : 503 }
  );
} 