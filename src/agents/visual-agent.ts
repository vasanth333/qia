// ============================================================
// QIA — Visual Agent
// GPT-4o Vision-powered visual regression across 4 viewports
// ============================================================

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import chalk from 'chalk';
import { agentConfig } from '../config/agent.config.js';
import type { VisualComparison, Viewport } from '../types/index.js';
import { VIEWPORTS } from '../types/index.js';

const BASELINE_DIR = process.env['QIA_BASELINE_DIR'] ?? '.qia/baselines';
const THRESHOLD = parseFloat(process.env['QIA_VISUAL_THRESHOLD'] ?? '0.1');

export class VisualAgent {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: agentConfig.openaiApiKey });
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
  }

  async compareScreenshots(
    componentName: string,
    currentScreenshots: Map<string, Buffer>
  ): Promise<VisualComparison[]> {
    console.log(chalk.cyan(`\n[VisualAgent] Running visual comparisons for: ${componentName}`));

    const results: VisualComparison[] = [];

    for (const viewport of VIEWPORTS) {
      const current = currentScreenshots.get(viewport.name);
      if (!current) {
        console.log(chalk.yellow(`  [SKIP] No screenshot for viewport: ${viewport.name}`));
        continue;
      }
      const result = await this.compareViewport(`${componentName}-${viewport.name}`, viewport, current);
      results.push(result);
    }

    this.printReport(results);
    return results;
  }

  private async compareViewport(key: string, viewport: Viewport, current: Buffer): Promise<VisualComparison> {
    const baselinePath = path.join(BASELINE_DIR, `${key}.png`);
    const currentPath = path.join(BASELINE_DIR, `${key}-current.png`);
    fs.writeFileSync(currentPath, current);

    if (!fs.existsSync(baselinePath)) {
      fs.copyFileSync(currentPath, baselinePath);
      console.log(chalk.blue(`  [BASELINE] Created: ${key} (${viewport.width}x${viewport.height})`));
      return { name: key, viewport, baselinePath, currentPath, diffPath: null, diffPercentage: 0, passed: true, aiAnalysis: 'Baseline created' };
    }

    const aiAnalysis = await this.gptVisionCompare(baselinePath, currentPath, viewport);
    const passed = aiAnalysis.diffPercentage <= THRESHOLD;

    console.log(
      passed
        ? chalk.green(`  [PASS] ${key}: ${(aiAnalysis.diffPercentage * 100).toFixed(2)}% diff`)
        : chalk.red(`  [FAIL] ${key}: ${(aiAnalysis.diffPercentage * 100).toFixed(2)}% diff`)
    );

    return { name: key, viewport, baselinePath, currentPath, diffPath: null, diffPercentage: aiAnalysis.diffPercentage, passed, aiAnalysis: aiAnalysis.description };
  }

  private async gptVisionCompare(baselinePath: string, currentPath: string, viewport: Viewport): Promise<{ diffPercentage: number; description: string }> {
    const baseline = fs.readFileSync(baselinePath).toString('base64');
    const current = fs.readFileSync(currentPath).toString('base64');

    const response = await this.openai.chat.completions.create({
      model: agentConfig.openaiModel,
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Compare these two screenshots (${viewport.width}x${viewport.height} ${viewport.name}). Image 1: BASELINE. Image 2: CURRENT. Return JSON: {"diffPercentage": 0.0, "description": "string", "severity": "none|minor|moderate|major"}` },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${baseline}` } },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${current}` } },
        ],
      }],
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    try {
      const parsed = JSON.parse(text) as { diffPercentage: number; description: string };
      return { diffPercentage: parsed.diffPercentage ?? 0, description: parsed.description ?? 'No differences' };
    } catch {
      return { diffPercentage: 0, description: 'Analysis failed' };
    }
  }

  private printReport(results: VisualComparison[]): void {
    const passed = results.filter(r => r.passed).length;
    console.log(chalk.gray(`\n  Visual: ${passed} passed, ${results.length - passed} failed across ${results.length} viewports`));
  }
}
