/**
 * GraphLint Criteria Engine - Type Definitions
 * Version: 2.0.0
 *
 * Real-time rule evaluation against SSoT
 */

/**
 * SSoT types (imported from intent-engine, replicated for independence)
 */
export interface SSoT {
  meta: SSoTMeta;
  nodes: Node[];
  edges: Edge[];
  indexes?: SSoTIndexes;
}

export interface SSoTMeta {
  version: string;
  profile_version: string;
  last_updated: string;
  created_at: string;
  collaboration_mode: 'autonomous' | 'copilot' | 'manual';
  description?: string;
}

export interface Node {
  id: string;
  kind: string;
  attrs: Record<string, any>;
  metadata?: NodeMetadata;
}

export interface NodeMetadata {
  created_at?: string;
  created_by?: 'user' | 'ai' | 'import';
  confidence?: number;
  intent_id?: string;
}

export interface Edge {
  from: string;
  kind: string;
  to: string;
  attrs?: Record<string, any>;
  metadata?: EdgeMetadata;
}

export interface EdgeMetadata {
  created_at?: string;
  created_by?: 'user' | 'ai' | 'derived';
  confidence?: number;
  intent_id?: string;
  is_derived?: boolean;
}

export interface SSoTIndexes {
  by_kind?: Record<string, string[]>;
  incoming_edges?: Record<string, Edge[]>;
  outgoing_edges?: Record<string, Edge[]>;
}

/**
 * Criteria Rule Definition
 */
export interface CriteriaRule {
  id: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARN' | 'FAIL';
  category: string;
  target: RuleTarget;
  condition: RuleCondition;
  message: string;
  why?: string;
  fix_hint?: string;
}

export interface RuleTarget {
  type: 'node' | 'edge' | 'graph' | 'attribute';
  kind?: string | string[];
  selector?: string;
}

export interface RuleCondition {
  type: 'exists' | 'not_exists' | 'count' | 'attribute' | 'connected' | 'custom';
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'matches' | 'not_matches';
  value?: any;
  path?: string;
  edge_kind?: string;
  min?: number;
  max?: number;
  function?: string;
}

/**
 * Criteria Evaluation Result
 */
export interface CriteriaEvaluation {
  ssot_version: string;
  timestamp: string;
  total_rules: number;
  passed: number;
  warned: number;
  failed: number;
  diagnostics: Diagnostic[];
  summary: EvaluationSummary;
}

export interface Diagnostic {
  rule_id: string;
  severity: 'INFO' | 'WARN' | 'FAIL';
  message: string;
  target_ref?: string;
  target_kind?: string;
  line?: number;
  column?: number;
  why?: string;
  fix_hint?: string;
  evidence_anchors?: string[];
  metadata?: DiagnosticMetadata;
}

export interface DiagnosticMetadata {
  rule_title?: string;
  category?: string;
  evaluated_at?: string;
  actual_value?: any;
  expected_value?: any;
}

export interface EvaluationSummary {
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  quality_score: number;
}

/**
 * Criteria Engine Options
 */
export interface CriteriaEngineOptions {
  criteriaDir: string;
  ssotPath?: string;
  autoLoad?: boolean;
  enableExplainability?: boolean;
}

/**
 * Criteria Catalog (loaded from checks/criteria/*.yaml)
 */
export interface CriteriaCatalog {
  version: string;
  categories: string[];
  rules: CriteriaRule[];
}

/**
 * Quality Gate Configuration
 */
export interface QualityGate {
  baseline: QualityThreshold;
  delta?: QualityThreshold;
  exception?: ExceptionRule[];
}

export interface QualityThreshold {
  max_fail?: number;
  max_warn?: number;
  min_quality_score?: number;
}

export interface ExceptionRule {
  rule_id: string;
  reason: string;
  expires_at?: string;
}
