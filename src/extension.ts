import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { registerPostgreSQLTools } from './tools';
import { registerDatabaseToolsParticipant } from './databaseParticipant';

export function activate(context: vscode.ExtensionContext) {
    console.log('VSCode PostgreSQL Tools Bridger extension is now active!');
    
    // Initialize MCP client
    const mcpClient = new McpClient();
    
    // Register the database tools participant
    registerDatabaseToolsParticipant(context, mcpClient);
    
    // Register the PostgreSQL tools (static registration)
    registerPostgreSQLTools(context, mcpClient);
    
    // Register configuration change listener
    const configListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('toolsBridger')) {
            mcpClient.updateConfiguration();
        }
    });
    
    context.subscriptions.push(configListener);
}

export function deactivate() {
    console.log('VSCode PostgreSQL Tools Bridger extension is now deactivated!');
}

 