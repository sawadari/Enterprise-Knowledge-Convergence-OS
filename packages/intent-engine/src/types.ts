/**
 * GraphLint Intent Engine - Type Definitions
 * Version: 2.0.0
 *
 * Intent-driven editing: Users issue intents, engine validates and executes
 */

import type { Operation } from 'fast-json-patch';

/**
 * SSoT (Single Source of Truth) format
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
 * Intent definitions
 */
export type IntentType =
  // Basic operations
  | 'I.AddNode'
  | 'I.AddEdge'
  | 'I.UpdateNodeAttrs'
  | 'I.UpdateEdgeAttrs'
  | 'I.DeleteNode'
  | 'I.DeleteEdge'
  | 'I.ToggleEdge'
  // NRVV operations
  | 'I.AddNeed'
  | 'I.AddRequirementRefinement'
  | 'I.AddValidationQuestion'
  | 'I.AttachValidationEvidence'
  | 'I.RequestAgreement'
  | 'I.PromoteValidationHintToQuestion'
  // AI operations
  | 'I.SuggestRequirements'
  | 'I.ExtractNodesFromText'
  | 'I.ExtractEdgesFromText'
  | 'I.EstimateNodeType';

export interface Intent<T = any> {
  type: IntentType;
  params: T;
  metadata?: IntentMetadata;
}

export interface IntentMetadata {
  intent_id: string;
  timestamp: string;
  user?: string;
  source?: 'user' | 'ai' | 'import';
  collaboration_mode?: 'autonomous' | 'copilot' | 'manual';
}

/**
 * Intent parameter types
 */
export interface AddNodeParams {
  kind: string;
  attrs?: Record<string, any>;
}

export interface AddEdgeParams {
  from_ref: string;
  edge_kind: string;
  to_ref: string;
  attrs?: Record<string, any>;
}

export interface UpdateNodeAttrsParams {
  node_ref: string;
  patch: Operation[];
}

export interface UpdateEdgeAttrsParams {
  from_ref: string;
  edge_kind: string;
  to_ref: string;
  patch: Operation[];
}

export interface DeleteNodeParams {
  node_ref: string;
  cascade?: boolean;
}

export interface DeleteEdgeParams {
  from_ref: string;
  edge_kind: string;
  to_ref: string;
}

export interface ToggleEdgeParams {
  from_ref: string;
  edge_kind: string;
  to_ref: string;
}

export interface AddNeedParams {
  attrs: Record<string, any>;
  expressed_by?: string;
}

export interface AddRequirementRefinementParams {
  need_ref: string;
  requirement_attrs: Record<string, any>;
}

export interface AddValidationQuestionParams {
  need_ref: string;
  question_attrs: Record<string, any>;
}

export interface AttachValidationEvidenceParams {
  validation_question_ref: string;
  evidence_attrs: Record<string, any>;
}

export interface RequestAgreementParams {
  target_ref: string;
  agreement_attrs: Record<string, any>;
}

export interface PromoteValidationHintToQuestionParams {
  need_ref: string;
}

/**
 * Intent execution result
 */
export interface IntentResult {
  success: boolean;
  intent_id: string;
  changes?: IntentChange[];
  errors?: ValidationError[];
  rollback?: RollbackInfo;
}

export interface IntentChange {
  type: 'node_added' | 'node_updated' | 'node_deleted' | 'edge_added' | 'edge_updated' | 'edge_deleted';
  target: string;
  details?: any;
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export interface RollbackInfo {
  reason: string;
  original_state_snapshot: any;
}

/**
 * Effective Schema (from profile compiler)
 */
export interface EffectiveSchema {
  version: string;
  source_profile: string;
  node_kinds: string[];
  edge_kinds: string[];
  edge_definitions: Record<string, EdgeDefinition>;
}

export interface EdgeDefinition {
  from: string[];
  to: string[];
  cardinality?: string;
  semantics?: string;
}

/**
 * Intent Engine Options
 */
export interface IntentEngineOptions {
  ssotPath: string;
  effectiveSchemaPath: string;
  historyDir?: string;
  autoSave?: boolean;
  validation?: {
    strict?: boolean;
    allowUnknownAttrs?: boolean;
  };
}

/**
 * Intent Catalog (loaded from standards/intent_catalog.yaml)
 */
export interface IntentCatalog {
  version: string;
  collaboration_modes: CollaborationMode[];
  intents: IntentDefinition[];
  execution_model: ExecutionModel;
}

export interface CollaborationMode {
  id: string;
  description: string;
  approval: string;
}

export interface IntentDefinition {
  id: string;
  title: string;
  scope: string;
  category: string;
  parameters: Record<string, ParameterDefinition>;
  returns?: Record<string, string>;
  validation?: string[];
  post_action?: string[];
  description?: string;
  ai_model?: string;
}

export interface ParameterDefinition {
  type: string;
  required: boolean;
  description?: string;
  default?: any;
  format?: string;
}

export interface ExecutionModel {
  steps: string[];
  rollback: string[];
  collaboration_mode_behavior: Record<string, string[]>;
}
