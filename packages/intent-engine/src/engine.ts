/**
 * GraphLint Intent Engine - Core Engine
 * Version: 2.0.0
 *
 * Validates and executes user intentions on SSoT
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as YAML from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import { applyPatch } from 'fast-json-patch';
import type {
  Intent,
  IntentResult,
  SSoT,
  Node,
  Edge,
  EffectiveSchema,
  IntentEngineOptions,
  ValidationError,
  IntentCatalog,
  AddNodeParams,
  AddEdgeParams,
  UpdateNodeAttrsParams,
  DeleteNodeParams,
  AddNeedParams,
  AddRequirementRefinementParams,
} from './types';

export class IntentEngine {
  private ssot: SSoT;
  private schema: EffectiveSchema;
  private catalog: IntentCatalog;
  private options: IntentEngineOptions;
  private ssotPath: string;

  constructor(options: IntentEngineOptions) {
    this.options = options;
    this.ssotPath = options.ssotPath;
    // Will be loaded in initialize()
    this.ssot = null as any;
    this.schema = null as any;
    this.catalog = null as any;
  }

  /**
   * Initialize engine by loading SSoT, schema, and catalog
   */
  async initialize(): Promise<void> {
    // Load SSoT
    const ssotContent = await fs.readFile(this.ssotPath, 'utf-8');
    this.ssot = JSON.parse(ssotContent);

    // Load effective schema
    const schemaContent = await fs.readFile(this.options.effectiveSchemaPath, 'utf-8');
    const schemaDoc = YAML.parse(schemaContent);
    this.schema = schemaDoc as EffectiveSchema;

    // Load intent catalog
    const catalogPath = path.join(path.dirname(this.options.effectiveSchemaPath), '..', 'intent_catalog.yaml');
    const catalogContent = await fs.readFile(catalogPath, 'utf-8');
    const catalogDoc = YAML.parse(catalogContent);
    this.catalog = {
      version: catalogDoc.version,
      collaboration_modes: catalogDoc.collaboration_modes || [],
      intents: catalogDoc.intents || [],
      execution_model: catalogDoc.execution_model || {},
    };

    // Rebuild indexes if missing
    if (!this.ssot.indexes) {
      this.rebuildIndexes();
    }
  }

  /**
   * Execute an intent
   */
  async execute<T>(intent: Intent<T>): Promise<IntentResult> {
    const intentId = uuidv4();
    const timestamp = new Date().toISOString();

    // Add metadata
    if (!intent.metadata) {
      intent.metadata = {
        intent_id: intentId,
        timestamp,
        source: 'user',
        collaboration_mode: this.ssot.meta.collaboration_mode,
      };
    }

    // Validate intent
    const validationErrors = await this.validateIntent(intent);
    if (validationErrors.length > 0) {
      return {
        success: false,
        intent_id: intentId,
        errors: validationErrors,
      };
    }

    // Create snapshot for rollback
    const snapshot = JSON.parse(JSON.stringify(this.ssot));

    try {
      // Execute based on intent type
      const changes = await this.executeIntentType(intent);

      // Update SSoT metadata
      this.ssot.meta.last_updated = timestamp;

      // Rebuild indexes
      this.rebuildIndexes();

      // Save if autoSave enabled
      if (this.options.autoSave) {
        await this.save();
      }

      // Record to history
      if (this.options.historyDir) {
        await this.recordHistory(intent, intentId, timestamp);
      }

      return {
        success: true,
        intent_id: intentId,
        changes,
      };
    } catch (error) {
      // Rollback on error
      this.ssot = snapshot;
      return {
        success: false,
        intent_id: intentId,
        errors: [
          {
            code: 'EXECUTION_FAILED',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        rollback: {
          reason: 'Execution error',
          original_state_snapshot: snapshot,
        },
      };
    }
  }

  /**
   * Validate intent parameters
   */
  private async validateIntent<T>(intent: Intent<T>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Find intent definition
    const intentDef = this.catalog.intents.find((i) => i.id === intent.type);
    if (!intentDef) {
      errors.push({
        code: 'UNKNOWN_INTENT',
        message: `Intent type '${intent.type}' not found in catalog`,
      });
      return errors;
    }

    // Validate parameters
    for (const [paramName, paramDef] of Object.entries(intentDef.parameters)) {
      const value = (intent.params as any)[paramName];

      if (paramDef.required && (value === undefined || value === null)) {
        errors.push({
          code: 'MISSING_PARAMETER',
          message: `Required parameter '${paramName}' is missing`,
          field: paramName,
        });
      }

      // Type-specific validation
      if (value !== undefined && value !== null) {
        if (paramDef.type === 'NodeRef' && !this.nodeExists(value)) {
          errors.push({
            code: 'INVALID_NODE_REF',
            message: `Node '${value}' does not exist`,
            field: paramName,
          });
        }

        if (paramDef.type === 'NodeKind' && !this.schema.node_kinds.includes(value)) {
          errors.push({
            code: 'INVALID_NODE_KIND',
            message: `Node kind '${value}' not in schema`,
            field: paramName,
          });
        }

        if (paramDef.type === 'EdgeKind' && !this.schema.edge_kinds.includes(value)) {
          errors.push({
            code: 'INVALID_EDGE_KIND',
            message: `Edge kind '${value}' not in schema`,
            field: paramName,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Execute specific intent type
   */
  private async executeIntentType<T>(intent: Intent<T>): Promise<any[]> {
    switch (intent.type) {
      case 'I.AddNode':
        return this.addNode(intent.params as AddNodeParams, intent.metadata!.intent_id);

      case 'I.AddEdge':
        return this.addEdge(intent.params as AddEdgeParams, intent.metadata!.intent_id);

      case 'I.UpdateNodeAttrs':
        return this.updateNodeAttrs(intent.params as UpdateNodeAttrsParams, intent.metadata!.intent_id);

      case 'I.DeleteNode':
        return this.deleteNode(intent.params as DeleteNodeParams, intent.metadata!.intent_id);

      case 'I.AddNeed':
        return this.addNeed(intent.params as AddNeedParams, intent.metadata!.intent_id);

      case 'I.AddRequirementRefinement':
        return this.addRequirementRefinement(intent.params as AddRequirementRefinementParams, intent.metadata!.intent_id);

      default:
        throw new Error(`Intent type '${intent.type}' not yet implemented`);
    }
  }

  /**
   * I.AddNode implementation
   */
  private addNode(params: AddNodeParams, intentId: string): any[] {
    const nodeId = uuidv4();
    const node: Node = {
      id: nodeId,
      kind: params.kind,
      attrs: params.attrs || {},
      metadata: {
        created_at: new Date().toISOString(),
        created_by: 'user',
        intent_id: intentId,
      },
    };

    this.ssot.nodes.push(node);

    return [
      {
        type: 'node_added',
        target: nodeId,
        details: { kind: params.kind },
      },
    ];
  }

  /**
   * I.AddEdge implementation
   */
  private addEdge(params: AddEdgeParams, intentId: string): any[] {
    // Validate edge constraints
    const edgeDef = this.schema.edge_definitions[params.edge_kind];
    if (!edgeDef) {
      throw new Error(`Edge kind '${params.edge_kind}' not found in schema`);
    }

    const fromNode = this.findNode(params.from_ref);
    const toNode = this.findNode(params.to_ref);

    if (!fromNode || !toNode) {
      throw new Error('Source or target node not found');
    }

    if (!edgeDef.from.includes(fromNode.kind)) {
      throw new Error(`Edge '${params.edge_kind}' cannot start from '${fromNode.kind}'`);
    }

    if (!edgeDef.to.includes(toNode.kind)) {
      throw new Error(`Edge '${params.edge_kind}' cannot go to '${toNode.kind}'`);
    }

    const edge: Edge = {
      from: params.from_ref,
      kind: params.edge_kind,
      to: params.to_ref,
      attrs: params.attrs,
      metadata: {
        created_at: new Date().toISOString(),
        created_by: 'user',
        intent_id: intentId,
      },
    };

    this.ssot.edges.push(edge);

    return [
      {
        type: 'edge_added',
        target: `${params.from_ref}->${params.edge_kind}->${params.to_ref}`,
        details: { kind: params.edge_kind },
      },
    ];
  }

  /**
   * I.UpdateNodeAttrs implementation
   */
  private updateNodeAttrs(params: UpdateNodeAttrsParams, intentId: string): any[] {
    const node = this.findNode(params.node_ref);
    if (!node) {
      throw new Error(`Node '${params.node_ref}' not found`);
    }

    // Apply JSON Patch
    const result = applyPatch(node.attrs, params.patch, true, false);
    node.attrs = result.newDocument;

    return [
      {
        type: 'node_updated',
        target: params.node_ref,
        details: { operations: params.patch.length },
      },
    ];
  }

  /**
   * I.DeleteNode implementation
   */
  private deleteNode(params: DeleteNodeParams, intentId: string): any[] {
    const nodeIndex = this.ssot.nodes.findIndex((n) => n.id === params.node_ref);
    if (nodeIndex === -1) {
      throw new Error(`Node '${params.node_ref}' not found`);
    }

    // Check for connected edges
    const connectedEdges = this.ssot.edges.filter(
      (e) => e.from === params.node_ref || e.to === params.node_ref
    );

    if (connectedEdges.length > 0 && !params.cascade) {
      throw new Error(
        `Node '${params.node_ref}' has ${connectedEdges.length} connected edges. Use cascade=true to delete them.`
      );
    }

    // Delete node
    this.ssot.nodes.splice(nodeIndex, 1);

    // Delete connected edges if cascade
    if (params.cascade) {
      this.ssot.edges = this.ssot.edges.filter(
        (e) => e.from !== params.node_ref && e.to !== params.node_ref
      );
    }

    return [
      {
        type: 'node_deleted',
        target: params.node_ref,
        details: { cascade: params.cascade, edges_deleted: connectedEdges.length },
      },
    ];
  }

  /**
   * I.AddNeed implementation (NRVV-specific)
   */
  private addNeed(params: AddNeedParams, intentId: string): any[] {
    const changes: any[] = [];

    // Create Need node
    const needId = uuidv4();
    const need: Node = {
      id: needId,
      kind: 'Need',
      attrs: params.attrs,
      metadata: {
        created_at: new Date().toISOString(),
        created_by: 'user',
        intent_id: intentId,
      },
    };

    this.ssot.nodes.push(need);
    changes.push({
      type: 'node_added',
      target: needId,
      details: { kind: 'Need' },
    });

    // If expressed_by is provided, create expresses edge
    if (params.expressed_by) {
      const edge: Edge = {
        from: params.expressed_by,
        kind: 'expresses',
        to: needId,
        metadata: {
          created_at: new Date().toISOString(),
          created_by: 'user',
          intent_id: intentId,
        },
      };

      this.ssot.edges.push(edge);
      changes.push({
        type: 'edge_added',
        target: `${params.expressed_by}->expresses->${needId}`,
        details: { kind: 'expresses' },
      });
    }

    return changes;
  }

  /**
   * I.AddRequirementRefinement implementation (NRVV-specific)
   */
  private addRequirementRefinement(params: AddRequirementRefinementParams, intentId: string): any[] {
    const changes: any[] = [];

    // Validate Need exists
    const need = this.findNode(params.need_ref);
    if (!need || need.kind !== 'Need') {
      throw new Error(`Need '${params.need_ref}' not found`);
    }

    // Create Requirement node
    const reqId = uuidv4();
    const requirement: Node = {
      id: reqId,
      kind: 'Requirement',
      attrs: params.requirement_attrs,
      metadata: {
        created_at: new Date().toISOString(),
        created_by: 'user',
        intent_id: intentId,
      },
    };

    this.ssot.nodes.push(requirement);
    changes.push({
      type: 'node_added',
      target: reqId,
      details: { kind: 'Requirement' },
    });

    // Create refinesTo edge
    const edge: Edge = {
      from: params.need_ref,
      kind: 'refinesTo',
      to: reqId,
      metadata: {
        created_at: new Date().toISOString(),
        created_by: 'user',
        intent_id: intentId,
      },
    };

    this.ssot.edges.push(edge);
    changes.push({
      type: 'edge_added',
      target: `${params.need_ref}->refinesTo->${reqId}`,
      details: { kind: 'refinesTo' },
    });

    return changes;
  }

  /**
   * Helper: Find node by ID
   */
  private findNode(id: string): Node | undefined {
    return this.ssot.nodes.find((n) => n.id === id);
  }

  /**
   * Helper: Check if node exists
   */
  private nodeExists(id: string): boolean {
    return this.ssot.nodes.some((n) => n.id === id);
  }

  /**
   * Rebuild SSoT indexes
   */
  private rebuildIndexes(): void {
    const byKind: Record<string, string[]> = {};
    const incomingEdges: Record<string, Edge[]> = {};
    const outgoingEdges: Record<string, Edge[]> = {};

    // Index nodes by kind
    for (const node of this.ssot.nodes) {
      if (!byKind[node.kind]) {
        byKind[node.kind] = [];
      }
      byKind[node.kind].push(node.id);
    }

    // Index edges
    for (const edge of this.ssot.edges) {
      if (!outgoingEdges[edge.from]) {
        outgoingEdges[edge.from] = [];
      }
      outgoingEdges[edge.from].push(edge);

      if (!incomingEdges[edge.to]) {
        incomingEdges[edge.to] = [];
      }
      incomingEdges[edge.to].push(edge);
    }

    this.ssot.indexes = {
      by_kind: byKind,
      incoming_edges: incomingEdges,
      outgoing_edges: outgoingEdges,
    };
  }

  /**
   * Save SSoT to file
   */
  async save(): Promise<void> {
    await fs.writeFile(this.ssotPath, JSON.stringify(this.ssot, null, 2), 'utf-8');
  }

  /**
   * Record intent execution to history
   */
  private async recordHistory(intent: Intent, intentId: string, timestamp: string): Promise<void> {
    if (!this.options.historyDir) return;

    const historyEntry = {
      intent_id: intentId,
      timestamp,
      intent_type: intent.type,
      params: intent.params,
      metadata: intent.metadata,
    };

    const historyFile = path.join(this.options.historyDir, `${intentId}.json`);
    await fs.mkdir(this.options.historyDir, { recursive: true });
    await fs.writeFile(historyFile, JSON.stringify(historyEntry, null, 2), 'utf-8');
  }

  /**
   * Get current SSoT
   */
  getSSoT(): SSoT {
    return this.ssot;
  }

  /**
   * Get effective schema
   */
  getSchema(): EffectiveSchema {
    return this.schema;
  }
}
