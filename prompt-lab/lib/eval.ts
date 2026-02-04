// Prompt Lab - Evaluation Engine
// Strict rule-based evaluation - no fuzzy matching

import { TestCase, EvalResult, EvalRules, ROOM_SYNONYMS } from '../adapters/types';

interface ModelOutput {
  rooms?: Array<{
    name: string;
    area?: number;
    floor?: string;
    roomType?: string;
  }>;
  totalArea?: number;
  [key: string]: any;
}

export function evaluateOutput(
  testCase: TestCase,
  output: ModelOutput,
  model: string,
  schemaVersion: string
): EvalResult {
  const failures: string[] = [];
  const rules = testCase.eval;
  const expected = testCase.expected;

  // Extract rooms from output
  const outputRooms = output.rooms || [];
  const expectedRooms = expected.rooms || [];

  // 1. Room count check (strict)
  const roomCountMatch = outputRooms.length === expected.room_count;
  if (!roomCountMatch) {
    failures.push(`Room count: expected ${expected.room_count}, got ${outputRooms.length}`);
  }

  // 2. Room name matching
  let roomNamesCorrect = 0;
  const matchedExpected = new Set<number>();
  const matchedOutput = new Set<number>();

  for (let i = 0; i < expectedRooms.length; i++) {
    const expectedRoom = expectedRooms[i];
    let found = false;

    for (let j = 0; j < outputRooms.length; j++) {
      if (matchedOutput.has(j)) continue;

      const outputRoom = outputRooms[j];
      const namesMatch = checkNameMatch(expectedRoom.name, outputRoom.name, rules.room_name_match);

      if (namesMatch) {
        found = true;
        matchedExpected.add(i);
        matchedOutput.add(j);
        roomNamesCorrect++;

        // Check area if expected
        if (expectedRoom.area !== undefined && rules.area_match !== 'ignore') {
          const areaMatch = checkAreaMatch(expectedRoom.area, outputRoom.area, rules.area_match);
          if (!areaMatch) {
            failures.push(`Room "${expectedRoom.name}": expected area ${expectedRoom.area}, got ${outputRoom.area || 'undefined'}`);
          }
        }
        break;
      }
    }

    if (!found && rules.missing_room === 'FAIL') {
      failures.push(`Missing room: "${expectedRoom.name}"`);
    }
  }

  // 3. Check for extra rooms
  for (let j = 0; j < outputRooms.length; j++) {
    if (!matchedOutput.has(j) && rules.extra_room === 'FAIL') {
      failures.push(`Extra room (not expected): "${outputRooms[j].name}"`);
    }
  }

  // Calculate scores
  const roomNameScore = expectedRooms.length > 0 ? roomNamesCorrect / expectedRooms.length : 1;

  // Area score (only for matched rooms with expected areas)
  let areasCorrect = 0;
  let areasChecked = 0;
  for (let i = 0; i < expectedRooms.length; i++) {
    if (matchedExpected.has(i) && expectedRooms[i].area !== undefined) {
      areasChecked++;
      const outputRoom = outputRooms[Array.from(matchedOutput)[Array.from(matchedExpected).indexOf(i)]];
      if (outputRoom && checkAreaMatch(expectedRooms[i].area!, outputRoom.area, rules.area_match)) {
        areasCorrect++;
      }
    }
  }
  const areaScore = areasChecked > 0 ? areasCorrect / areasChecked : 1;

  // Overall score
  const overall = (roomCountMatch ? 0.3 : 0) + (roomNameScore * 0.4) + (areaScore * 0.3);

  return {
    test_id: testCase.id,
    model,
    schema_version: schemaVersion,
    timestamp: new Date().toISOString(),
    passed: failures.length === 0,
    scores: {
      room_count_match: roomCountMatch,
      room_names_correct: roomNameScore,
      areas_correct: areaScore,
      overall
    },
    failures,
    raw_output: output
  };
}

function checkNameMatch(expected: string, actual: string, rule: EvalRules['room_name_match']): boolean {
  const normalizedExpected = expected.toUpperCase().trim();
  const normalizedActual = actual.toUpperCase().trim();

  // Exact match
  if (normalizedExpected === normalizedActual) {
    return true;
  }

  // Synonym matching
  if (rule === 'exact_with_synonyms') {
    // Check if actual is a synonym of expected
    for (const [canonical, synonyms] of Object.entries(ROOM_SYNONYMS)) {
      const allForms = [canonical, ...synonyms].map(s => s.toUpperCase());

      if (allForms.includes(normalizedExpected) && allForms.includes(normalizedActual)) {
        return true;
      }
    }

    // Check partial matches for numbered rooms (e.g., "BEDROOM 01" vs "BEDROOM 1")
    const expectedBase = normalizedExpected.replace(/\s*0*(\d+)$/, ' $1').trim();
    const actualBase = normalizedActual.replace(/\s*0*(\d+)$/, ' $1').trim();
    if (expectedBase === actualBase) {
      return true;
    }
  }

  return false;
}

function checkAreaMatch(expected: number, actual: number | undefined, rule: EvalRules['area_match']): boolean {
  if (actual === undefined || actual === null) {
    return false;
  }

  if (rule === 'exact_when_labeled') {
    // Must match exactly (within 1 sq ft for rounding)
    return Math.abs(expected - actual) <= 1;
  }

  if (rule === 'range_5_percent') {
    const tolerance = expected * 0.05;
    return Math.abs(expected - actual) <= tolerance;
  }

  return true;
}

export function formatEvalResult(result: EvalResult): string {
  let output = '';
  output += `\n${'='.repeat(60)}\n`;
  output += `EVAL: ${result.test_id} | Model: ${result.model}\n`;
  output += `${'='.repeat(60)}\n`;
  output += `Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`;
  output += `Timestamp: ${result.timestamp}\n`;
  output += `Schema Version: ${result.schema_version}\n\n`;

  output += `SCORES:\n`;
  output += `  Room count match: ${result.scores.room_count_match ? '✓' : '✗'}\n`;
  output += `  Room names: ${(result.scores.room_names_correct * 100).toFixed(0)}%\n`;
  output += `  Areas: ${(result.scores.areas_correct * 100).toFixed(0)}%\n`;
  output += `  Overall: ${(result.scores.overall * 100).toFixed(0)}%\n`;

  if (result.failures.length > 0) {
    output += `\nFAILURES:\n`;
    for (const failure of result.failures) {
      output += `  ❌ ${failure}\n`;
    }
  }

  return output;
}
