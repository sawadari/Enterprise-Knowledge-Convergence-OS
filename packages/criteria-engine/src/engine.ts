/**
 * GraphLint Criteria Engine - Core Engine
 * Version: 2.0.0
 *
 * Real-time rule evaluation against SSoT
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as YAML from 'yaml';
import type {
  SSoT,
  Node,
  Edge,
  CriteriaRule,
  CriteriaEvaluation,
  Diagnostic,
  CriteriaEngineOptions,
  CriteriaCatalog,
  RuleCondition,
  RuleTarget,
  EvaluationSummary,
  QualityGate,
} from './types';

export class CriteriaEngine {
  private rules: CriteriaRule[] = [];
  private options: CriteriaEngineOptions;
  private qualityGate?: QualityGate;

  constructor(options: CriteriaEngineOptions) {
    this.options = options;
  }

  /**
   * Initialize engine by loading criteria rules
   */
  async initialize(): Promise<void> {
    if (this.options.autoLoad !== false) {
      await this.loadRules();
    }
  }

  /**
   * Load all criteria rules from directory
   */
  async loadRules(): Promise<void> {
    const criteriaDir = this.options.criteriaDir;

    try {
      const files = await fs.readdir(criteriaDir);
      const yamlFiles = files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of yamlFiles) {
        const filePath = path.join(criteriaDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const doc = YAML.parse(content) as CriteriaCatalog;

        if (doc.rules) {
          this.rules.push(...doc.rules);
        }
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.warn(`Criteria directory not found: ${criteriaDir}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Evaluate SSoT against all loaded rules
   */
  async evaluate(ssot: SSoT): Promise<CriteriaEvaluation> {
    const timestamp = new Date().toISOString();
    const diagnostics: Diagnostic[] = [];

    for (const rule of this.rules) {
      const ruleDiagnostics = await this.evaluateRule(rule, ssot);
      diagnostics.push(...ruleDiagnostics);
    }

    // Count by severity
    const passed = this.rules.length - diagnostics.length;
    const warned = diagnostics.filter((d) => d.severity === 'WARN').length;
    const failed = diagnostics.filter((d) => d.severity === 'FAIL').length;

    // Calculate quality score (0-100)
    const qualityScore = this.calculateQualityScore(this.rules.length, failed, warned);

    // Summarize by category
    const byCategory: Record<string, number> = {};
    for (const rule of this.rules) {
      byCategory[rule.category] = (byCategory[rule.category] || 0) + 1;
    }

    const summary: EvaluationSummary = {
      by_severity: {
        PASS: passed,
        WARN: warned,
        FAIL: failed,
      },
      by_category: byCategory,
      quality_score: qualityScore,
    };

    return {
      ssot_version: ssot.meta.version,
      timestamp,
      total_rules: this.rules.length,
      passed,
      warned,
      failed,
      diagnostics,
      summary,
    };
  }

  /**
   * Evaluate a single rule against SSoT
   */
  private async evaluateRule(rule: CriteriaRule, ssot: SSoT): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    try {
      const violations = await this.checkRuleCondition(rule, ssot);

      for (const violation of violations) {
        const diagnostic: Diagnostic = {
          rule_id: rule.id,
          severity: rule.severity,
          message: this.formatMessage(rule.message, violation),
          target_ref: violation.target_ref,
          target_kind: violation.target_kind,
          why: rule.why,
          fix_hint: rule.fix_hint,
          evidence_anchors: violation.evidence_anchors,
          metadata: {
            rule_title: rule.title,
            category: rule.category,
            evaluated_at: new Date().toISOString(),
            actual_value: violation.actual_value,
            expected_value: violation.expected_value,
          },
        };

        diagnostics.push(diagnostic);
      }
    } catch (error) {
      console.error(`Failed to evaluate rule ${rule.id}:`, error);
    }

    return diagnostics;
  }

  /**
   * Check rule condition and return violations
   */
  private async checkRuleCondition(
    rule: CriteriaRule,
    ssot: SSoT
  ): Promise<RuleViolation[]> {
    const { target, condition } = rule;
    const violations: RuleViolation[] = [];

    // Get target nodes/edges
    const targets = this.getTargets(target, ssot);

    switch (condition.type) {
      case 'exists':
        if (targets.length === 0) {
          violations.push({
            target_ref: undefined,
            target_kind: Array.isArray(target.kind) ? target.kind.join('|') : target.kind,
            evidence_anchors: [],
            actual_value: 0,
            expected_value: 'at least 1',
          });
        }
        break;

      case 'not_exists':
        if (targets.length > 0) {
          for (const t of targets) {
            violations.push({
              target_ref: t.id,
              target_kind: t.kind,
              evidence_anchors: [t.id],
              actual_value: 'exists',
              expected_value: 'should not exist',
            });
          }
        }
        break;

      case 'count':
        const count = targets.length;
        const { min, max } = condition;
        if ((min !== undefined && count < min) || (max !== undefined && count > max)) {
          violations.push({
            target_ref: undefined,
            target_kind: Array.isArray(target.kind) ? target.kind.join('|') : target.kind,
            evidence_anchors: targets.map((t) => t.id),
            actual_value: count,
            expected_value: `${min !== undefined ? `>=${min}` : ''}${max !== undefined ? ` <=${max}` : ''}`,
          });
        }
        break;

      case 'attribute':
        for (const t of targets) {
          const violation = this.checkAttributeCondition(t, condition, rule);
          if (violation) {
            violations.push(violation);
          }
        }
        break;

      case 'connected':
        for (const t of targets) {
          const violation = this.checkConnectedCondition(t, condition, ssot, rule);
          if (violation) {
            violations.push(violation);
          }
        }
        break;

      default:
        console.warn(`Unknown condition type: ${condition.type}`);
    }

    return violations;
  }

  /**
   * Get target nodes/edges based on rule target
   */
  private getTargets(target: RuleTarget, ssot: SSoT): TargetNode[] {
    if (target.type === 'node') {
      let nodes = ssot.nodes;

      // Filter by kind
      if (target.kind) {
        const kinds = Array.isArray(target.kind) ? target.kind : [target.kind];
        nodes = nodes.filter((n) => kinds.includes(n.kind));
      }

      return nodes.map((n) => ({ id: n.id, kind: n.kind, data: n }));
    }

    if (target.type === 'edge') {
      let edges = ssot.edges;

      if (target.kind) {
        const kinds = Array.isArray(target.kind) ? target.kind : [target.kind];
        edges = edges.filter((e) => kinds.includes(e.kind));
      }

      return edges.map((e) => ({ id: `${e.from}->${e.kind}->${e.to}`, kind: e.kind, data: e }));
    }

    return [];
  }

  /**
   * Check attribute condition
   */
  private checkAttributeCondition(
    target: TargetNode,
    condition: RuleCondition,
    rule: CriteriaRule
  ): RuleViolation | null {
    const node = target.data as Node;
    const attrPath = condition.path!;
    const actualValue = this.getNestedValue(node.attrs, attrPath);
    const expectedValue = condition.value;
    const operator = condition.operator || 'eq';

    const passed = this.compareValues(actualValue, expectedValue, operator);

    if (!passed) {
      return {
        target_ref: target.id,
        target_kind: target.kind,
        evidence_anchors: [target.id],
        actual_value: actualValue,
        expected_value: expectedValue,
      };
    }

    return null;
  }

  /**
   * Check connected condition
   */
  private checkConnectedCondition(
    target: TargetNode,
    condition: RuleCondition,
    ssot: SSoT,
    rule: CriteriaRule
  ): RuleViolation | null {
    const nodeId = target.id;
    const edgeKind = condition.edge_kind!;
    const minCount = condition.min || 1;

    // Find connected edges
    const connectedEdges =
      ssot.indexes?.outgoing_edges?.[nodeId]?.filter((e) => e.kind === edgeKind) || [];

    if (connectedEdges.length < minCount) {
      return {
        target_ref: nodeId,
        target_kind: target.kind,
        evidence_anchors: [nodeId],
        actual_value: connectedEdges.length,
        expected_value: `>=${minCount} ${edgeKind} edges`,
      };
    }

    return null;
  }

  /**
   * Get nested value from object by path (e.g., "user.name")
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  /**
   * Compare values with operator
   */
  private compareValues(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'gt':
        return actual > expected;
      case 'gte':
        return actual >= expected;
      case 'lt':
        return actual < expected;
      case 'lte':
        return actual <= expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'matches':
        return typeof expected === 'string' && new RegExp(expected).test(String(actual));
      case 'not_matches':
        return typeof expected === 'string' && !new RegExp(expected).test(String(actual));
      default:
        return false;
    }
  }

  /**
   * Format message with violation data
   */
  private formatMessage(template: string, violation: RuleViolation): string {
    return template
      .replace(/{target_ref}/g, violation.target_ref || 'unknown')
      .replace(/{actual_value}/g, String(violation.actual_value))
      .replace(/{expected_value}/g, String(violation.expected_value));
  }

  /**
   * Calculate quality score (0-100)
   * Formula: 100 - (FAIL * 10 + WARN * 2)
   */
  private calculateQualityScore(total: number, failed: number, warned: number): number {
    if (total === 0) return 100;

    const penalty = failed * 10 + warned * 2;
    const score = 100 - penalty;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check quality gate
   */
  checkQualityGate(evaluation: CriteriaEvaluation, gate?: QualityGate): boolean {
    const g = gate || this.qualityGate;
    if (!g) return true;

    const { baseline } = g;

    if (baseline.max_fail !== undefined && evaluation.failed > baseline.max_fail) {
      return false;
    }

    if (baseline.max_warn !== undefined && evaluation.warned > baseline.max_warn) {
      return false;
    }

    if (
      baseline.min_quality_score !== undefined &&
      evaluation.summary.quality_score < baseline.min_quality_score
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get all loaded rules
   */
  getRules(): CriteriaRule[] {
    return this.rules;
  }

  /**
   * Set quality gate
   */
  setQualityGate(gate: QualityGate): void {
    this.qualityGate = gate;
  }
}

/**
 * Internal types
 */
interface TargetNode {
  id: string;
  kind: string;
  data: Node | Edge;
}

interface RuleViolation {
  target_ref?: string;
  target_kind?: string;
  evidence_anchors: string[];
  actual_value?: any;
  expected_value?: any;
}
