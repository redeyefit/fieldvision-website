#!/usr/bin/env npx ts-node

// Prompt Lab CLI
// Usage:
//   promptlab render --schema floor_plan_extraction --model gemini
//   promptlab test --schema floor_plan_extraction --case feliz_floor2 --model gemini
//   promptlab export --schema floor_plan_extraction --model gemini --format swift
//   promptlab list

import { Command } from 'commander';
import { renderPrompt, ModelType, getSupportedModels } from './adapters';
import { loadSchema, loadTestCase, listSchemas, listTestCases, saveEvalResult, getImagePath } from './lib/loader';
import { runPrompt } from './lib/runner';
import { evaluateOutput, formatEvalResult } from './lib/eval';

const program = new Command();

program
  .name('promptlab')
  .description('Prompt Lab CLI - Iterate on AI prompts fast')
  .version('1.0.0');

// List command
program
  .command('list')
  .description('List available schemas and test cases')
  .action(() => {
    console.log('\n📋 SCHEMAS:');
    const schemas = listSchemas();
    if (schemas.length === 0) {
      console.log('  (none found)');
    } else {
      schemas.forEach(s => console.log(`  - ${s}`));
    }

    console.log('\n🧪 TEST CASES:');
    const cases = listTestCases();
    if (cases.length === 0) {
      console.log('  (none found)');
    } else {
      cases.forEach(c => console.log(`  - ${c}`));
    }

    console.log('\n🤖 MODELS:');
    getSupportedModels().forEach(m => console.log(`  - ${m}`));
    console.log('');
  });

// Render command
program
  .command('render')
  .description('Render a schema for a specific model')
  .requiredOption('-s, --schema <name>', 'Schema name')
  .requiredOption('-m, --model <model>', 'Model (gemini, claude, openai)')
  .option('-v, --variables <json>', 'Variables as JSON string')
  .action((options) => {
    try {
      const schema = loadSchema(options.schema);
      const variables = options.variables ? JSON.parse(options.variables) : {};
      const rendered = renderPrompt(schema, options.model as ModelType, variables);

      console.log('\n' + '='.repeat(60));
      console.log(`RENDERED PROMPT: ${schema.name} → ${options.model}`);
      console.log('='.repeat(60));

      if (rendered.system) {
        console.log('\n[SYSTEM]');
        console.log(rendered.system);
      }

      console.log('\n[USER]');
      console.log(rendered.user);

      console.log('\n' + '='.repeat(60) + '\n');
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Run a test case against a model')
  .requiredOption('-s, --schema <name>', 'Schema name')
  .requiredOption('-c, --case <name>', 'Test case name')
  .requiredOption('-m, --model <model>', 'Model (gemini, claude, openai)')
  .option('--save', 'Save eval result to file')
  .action(async (options) => {
    try {
      console.log(`\n🔬 Running test: ${options.case} with ${options.model}...`);

      const schema = loadSchema(options.schema);
      const testCase = loadTestCase(options.case);
      const variables = testCase.input.variables || {};

      // Render prompt
      const rendered = renderPrompt(schema, options.model as ModelType, variables);

      // Get image path
      const imagePath = getImagePath(testCase);
      if (!imagePath && testCase.input.image) {
        console.error(`❌ Image not found: ${testCase.input.image}`);
        process.exit(1);
      }

      console.log(`📤 Calling ${options.model}...`);

      // Run prompt
      const result = await runPrompt(rendered, imagePath || undefined);

      if (!result.success) {
        console.error(`❌ API Error: ${result.error}`);
        process.exit(1);
      }

      console.log(`⏱️  Response in ${result.latencyMs}ms`);

      // Evaluate
      const evalResult = evaluateOutput(testCase, result.output, options.model, schema.version);

      // Display results
      console.log(formatEvalResult(evalResult));

      // Show raw output
      console.log('\nRAW OUTPUT:');
      console.log(JSON.stringify(result.output, null, 2));

      // Save if requested
      if (options.save) {
        saveEvalResult(evalResult, testCase.id);
      }

      // Exit with appropriate code
      process.exit(evalResult.passed ? 0 : 1);

    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Export command
program
  .command('export')
  .description('Export rendered prompt for production use')
  .requiredOption('-s, --schema <name>', 'Schema name')
  .requiredOption('-m, --model <model>', 'Model (gemini, claude, openai)')
  .option('-f, --format <format>', 'Output format (swift, json)', 'json')
  .option('-v, --variables <json>', 'Variables as JSON string')
  .action((options) => {
    try {
      const schema = loadSchema(options.schema);
      const variables = options.variables ? JSON.parse(options.variables) : {};
      const rendered = renderPrompt(schema, options.model as ModelType, variables);

      if (options.format === 'swift') {
        console.log('\n// Generated by Prompt Lab');
        console.log(`// Schema: ${schema.name} v${schema.version}`);
        console.log(`// Model: ${options.model}`);
        console.log('// Date: ' + new Date().toISOString().split('T')[0]);
        console.log('');

        if (rendered.system) {
          console.log('let systemPrompt = """');
          console.log(rendered.system);
          console.log('"""');
          console.log('');
        }

        console.log('let userPrompt = """');
        console.log(rendered.user);
        console.log('"""');
      } else {
        console.log(JSON.stringify(rendered, null, 2));
      }

    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Compare command
program
  .command('compare')
  .description('Compare a test case across multiple models')
  .requiredOption('-s, --schema <name>', 'Schema name')
  .requiredOption('-c, --case <name>', 'Test case name')
  .option('-m, --models <models>', 'Comma-separated models', 'gemini,claude')
  .action(async (options) => {
    try {
      const models = options.models.split(',') as ModelType[];
      const schema = loadSchema(options.schema);
      const testCase = loadTestCase(options.case);
      const imagePath = getImagePath(testCase);

      console.log(`\n📊 Comparing ${models.join(' vs ')} on ${options.case}...\n`);

      const results: any[] = [];

      for (const model of models) {
        console.log(`Running ${model}...`);
        const variables = testCase.input.variables || {};
        const rendered = renderPrompt(schema, model, variables);
        const result = await runPrompt(rendered, imagePath || undefined);

        if (result.success) {
          const evalResult = evaluateOutput(testCase, result.output, model, schema.version);
          results.push({ model, evalResult, latencyMs: result.latencyMs });
          console.log(`  ${evalResult.passed ? '✅' : '❌'} ${model}: ${(evalResult.scores.overall * 100).toFixed(0)}% (${result.latencyMs}ms)`);
        } else {
          console.log(`  ❌ ${model}: Error - ${result.error}`);
        }
      }

      // Summary table
      console.log('\n' + '='.repeat(60));
      console.log('COMPARISON SUMMARY');
      console.log('='.repeat(60));
      console.log('Model\t\tPass\tRooms\tAreas\tOverall\tLatency');
      console.log('-'.repeat(60));

      for (const r of results) {
        const e = r.evalResult;
        console.log(`${r.model}\t\t${e.passed ? '✅' : '❌'}\t${(e.scores.room_names_correct * 100).toFixed(0)}%\t${(e.scores.areas_correct * 100).toFixed(0)}%\t${(e.scores.overall * 100).toFixed(0)}%\t${r.latencyMs}ms`);
      }

      console.log('');

    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
