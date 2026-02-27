// ============================================================
// QIA — Vision Comparator (GPT-4o Vision)
// Uses OpenAI GPT-4o multimodal API to compare screenshots
// ============================================================

import fs from 'fs';
import OpenAI from 'openai';
import { agentConfig } from '../config/agent.config.js';
import type { VisualComparison, Viewport } from '../types/index.js';

export interface ComparisonResult {
  diffPercentage: number;
  severity: 'none' | 'minor' | 'moderate' | 'major';
  description: string;
  changedAreas: string[];
  recommendation: 'accept' | 'investigate' | 'reject';
}

export class VisionComparator {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: agentConfig.openaiApiKey });
  }

  async compare(baselinePath: string, currentPath: string, viewport: Viewport, componentName: string): Promise<ComparisonResult> {
    if (!fs.existsSync(baselinePath)) throw new Error(`Baseline not found: ${baselinePath}`);
    if (!fs.existsSync(currentPath)) throw new Error(`Current screenshot not found: ${currentPath}`);

    const baseline = fs.readFileSync(baselinePath).toString('base64');
    const current = fs.readFileSync(currentPath).toString('base64');

    const response = await this.openai.chat.completions.create({
      model: agentConfig.openaiModel,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are a Visual QA Expert. Compare these two screenshots for component "${componentName}" at ${viewport.width}x${viewport.height} (${viewport.name}).
Image 1: BASELINE (expected). Image 2: CURRENT (actual).
Analyze layout, colors, typography, content differences.
Return JSON: {"diffPercentage": 0.0, "severity": "none|minor|moderate|major", "description": "string", "changedAreas": [], "recommendation": "accept|investigate|reject"}`,
          },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${baseline}` } },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${current}` } },
        ],
      }],
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    try {
      return JSON.parse(text) as ComparisonResult;
    } catch {
      return { diffPercentage: 0, severity: 'none', description: 'Analysis failed', changedAreas: [], recommendation: 'investigate' };
    }
  }

  toVisualComparison(result: ComparisonResult, name: string, viewport: Viewport, baselinePath: string, currentPath: string, threshold: number): VisualComparison {
    return { name, viewport, baselinePath, currentPath, diffPath: null, diffPercentage: result.diffPercentage, passed: result.diffPercentage <= threshold, aiAnalysis: result.description };
  }
}

// Keep old name as alias for backwards compat
export { VisionComparator as ClaudeVisionComparator };
