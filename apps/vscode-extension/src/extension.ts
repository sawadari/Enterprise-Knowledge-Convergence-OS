/**
 * EKC VS Code Extension
 * Minimal implementation with Intent Engine integration
 */

import * as vscode from 'vscode';
import { IntentCommandProvider } from './intentCommands';

let intentCommandProvider: IntentCommandProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('[EKC] Extension activating...');

  // Initialize Intent Command Provider
  intentCommandProvider = new IntentCommandProvider(context);
  intentCommandProvider.registerCommands();

  console.log('[EKC] Extension activated successfully');
}

export function deactivate() {
  console.log('[EKC] Extension deactivating...');
}
