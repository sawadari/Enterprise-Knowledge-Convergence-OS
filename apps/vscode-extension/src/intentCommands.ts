/**
 * EKC Intent Commands for VS Code
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { IntentEngine } from '@ekc/intent-engine';

export class IntentCommandProvider {
  private context: vscode.ExtensionContext;
  private engine: IntentEngine | null = null;
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.outputChannel = vscode.window.createOutputChannel('EKC');

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.text = '$(pulse) EKC: Not initialized';
    this.statusBarItem.show();
    context.subscriptions.push(this.statusBarItem);
  }

  registerCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('ekc.initializeIntentEngine', async () => {
        await this.initialize();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('ekc.addNeed', async () => {
        await this.addNeed();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('ekc.addRequirement', async () => {
        await this.addRequirement();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('ekc.showStatistics', async () => {
        await this.showStatistics();
      })
    );
  }

  async initialize(): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const ssotPath = path.join(workspaceFolder.uri.fsPath, 'state', 'ssot.json');
      const schemaPath = path.join(workspaceFolder.uri.fsPath, 'standards', 'compiled', 'effective_schema.yaml');

      this.engine = new IntentEngine({
        ssotPath,
        effectiveSchemaPath: schemaPath,
        autoSave: true,
      });

      await this.engine.initialize();

      this.statusBarItem.text = '$(check) EKC: Ready';
      this.outputChannel.appendLine('[EKC] Intent Engine initialized successfully');
      vscode.window.showInformationMessage('EKC Intent Engine initialized');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[EKC] Initialization failed: ${message}`);
      vscode.window.showErrorMessage(`Failed to initialize: ${message}`);
    }
  }

  async addNeed(): Promise<void> {
    if (!this.engine) {
      vscode.window.showWarningMessage('Please initialize Intent Engine first');
      await vscode.commands.executeCommand('ekc.initializeIntentEngine');
      return;
    }

    const statement = await vscode.window.showInputBox({
      prompt: 'Enter need statement',
      placeHolder: 'e.g., システムは緊急時に安全に停止できること',
    });

    if (!statement) return;

    const priority = await vscode.window.showQuickPick(['high', 'medium', 'low'], {
      placeHolder: 'Select priority',
    });

    if (!priority) return;

    try {
      const result = await this.engine.execute({
        type: 'I.AddNeed',
        params: {
          attrs: {
            statement,
            priority,
          },
        },
      });

      if (result.success) {
        vscode.window.showInformationMessage(`Need added successfully (ID: ${result.intent_id})`);
        this.outputChannel.appendLine(`[EKC] Need added: ${statement}`);
      } else {
        const errors = result.errors?.map((e) => e.message).join(', ') || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to add need: ${errors}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Error: ${message}`);
    }
  }

  async addRequirement(): Promise<void> {
    if (!this.engine) {
      vscode.window.showWarningMessage('Please initialize Intent Engine first');
      await vscode.commands.executeCommand('ekc.initializeIntentEngine');
      return;
    }

    // Get available needs
    const ssot = (this.engine as any).ssot;
    const needs = ssot.nodes.filter((n: any) => n.kind === 'Need');

    if (needs.length === 0) {
      vscode.window.showWarningMessage('No needs available. Please create a need first.');
      return;
    }

    const needItems = needs.map((n: any) => ({
      label: n.id,
      description: n.attrs.statement,
    }));

    const selectedNeed = await vscode.window.showQuickPick(needItems, {
      placeHolder: 'Select parent need',
    }) as { label: string; description: string } | undefined;

    if (!selectedNeed) return;

    const statement = await vscode.window.showInputBox({
      prompt: 'Enter requirement statement',
      placeHolder: 'e.g., システムは緊急停止ボタンを備えること',
    });

    if (!statement) return;

    try {
      const result = await this.engine.execute({
        type: 'I.AddRequirementRefinement',
        params: {
          need_ref: selectedNeed.label,
          requirement_attrs: {
            statement,
            level: 'system',
          },
        },
      });

      if (result.success) {
        vscode.window.showInformationMessage(`Requirement added successfully (ID: ${result.intent_id})`);
        this.outputChannel.appendLine(`[EKC] Requirement added: ${statement}`);
      } else {
        const errors = result.errors?.map((e) => e.message).join(', ') || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to add requirement: ${errors}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Error: ${message}`);
    }
  }

  async showStatistics(): Promise<void> {
    if (!this.engine) {
      vscode.window.showWarningMessage('Please initialize Intent Engine first');
      return;
    }

    const ssot = (this.engine as any).ssot;
    const nodesByKind: Record<string, number> = {};

    for (const node of ssot.nodes) {
      nodesByKind[node.kind] = (nodesByKind[node.kind] || 0) + 1;
    }

    const stats = Object.entries(nodesByKind)
      .map(([kind, count]) => `  ${kind}: ${count}`)
      .join('\n');

    const message = `EKC Statistics:\n\nNodes: ${ssot.nodes.length}\nEdges: ${ssot.edges.length}\n\nBy Kind:\n${stats}`;

    vscode.window.showInformationMessage(message, { modal: true });
  }
}
