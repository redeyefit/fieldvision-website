// Prompt Lab - Schema and Test Case Loader

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { MasterSchema, TestCase } from '../adapters/types';

const SCHEMAS_DIR = path.join(__dirname, '..', 'schemas');
const TEST_CASES_DIR = path.join(__dirname, '..', 'test_cases');

export function loadSchema(name: string): MasterSchema {
  const filePath = path.join(SCHEMAS_DIR, `${name}.yaml`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Schema not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const schema = yaml.parse(content) as MasterSchema;

  // Validate required fields
  const required = ['name', 'goal', 'constraints', 'output_schema'];
  for (const field of required) {
    if (!(field in schema)) {
      throw new Error(`Schema missing required field: ${field}`);
    }
  }

  return schema;
}

export function loadTestCase(name: string): TestCase {
  const filePath = path.join(TEST_CASES_DIR, `${name}.yaml`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Test case not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const testCase = yaml.parse(content) as TestCase;

  // Validate required fields
  if (!testCase.id || !testCase.input || !testCase.expected || !testCase.eval) {
    throw new Error(`Test case missing required fields: id, input, expected, eval`);
  }

  return testCase;
}

export function listSchemas(): string[] {
  if (!fs.existsSync(SCHEMAS_DIR)) {
    return [];
  }

  return fs.readdirSync(SCHEMAS_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''));
}

export function listTestCases(): string[] {
  if (!fs.existsSync(TEST_CASES_DIR)) {
    return [];
  }

  return fs.readdirSync(TEST_CASES_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''));
}

export function saveEvalResult(result: any, testId: string): void {
  const evalsDir = path.join(__dirname, '..', 'evals');
  if (!fs.existsSync(evalsDir)) {
    fs.mkdirSync(evalsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${timestamp}_${testId}_${result.model}.json`;
  const filePath = path.join(evalsDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  console.log(`Eval saved: ${filePath}`);
}

export function getImagePath(testCase: TestCase): string | null {
  if (testCase.input.image) {
    const imagePath = path.isAbsolute(testCase.input.image)
      ? testCase.input.image
      : path.join(TEST_CASES_DIR, testCase.input.image);

    if (fs.existsSync(imagePath)) {
      return imagePath;
    }
  }
  return null;
}
