import * as vscode from 'vscode';
import { McpServerDiscovery } from './mcpServerDiscovery';
import { DynamicToolRegistry } from './dynamicToolRegistry';
import { ProxyToolHandlers } from './proxyToolHandlers';
import { registerAdaptiveToolsParticipant } from './adaptiveParticipant';

let serverDiscovery: McpServerDiscovery;
let toolRegistry: DynamicToolRegistry;
let proxyHandlers: ProxyToolHandlers;

export function activate(context: vscode.ExtensionContext) {
    console.log('VSCode Dynamic Tools Bridger extension is now active!');
    
    try {
        // Register commands first (these are safe to register immediately)
        registerCommands(context);
        
        // Register configuration change listener
        const configListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('toolsBridger')) {
                handleConfigurationChange(event);
            }
        });
        context.subscriptions.push(configListener);
        
        // Initialize the dynamic tools bridger system
        initializeDynamicToolsBridger(context);
        console.log('Dynamic Tools Bridger initialization complete!');
        
    } catch (error) {
        console.error('Error activating Dynamic Tools Bridger:', error);
        vscode.window.showErrorMessage(`Failed to activate Dynamic Tools Bridger: ${error}`);
    }
}

function initializeDynamicToolsBridger(context: vscode.ExtensionContext) {
    // Initialize MCP server discovery
    serverDiscovery = new McpServerDiscovery(context);
    
    // Initialize dynamic tool registry
    toolRegistry = new DynamicToolRegistry(context, serverDiscovery);
    
    // Initialize proxy tool handlers
    proxyHandlers = new ProxyToolHandlers(toolRegistry, serverDiscovery);
    
    // Register proxy tool handlers - these now gracefully handle missing tools
    proxyHandlers.registerHandlers(context);
    
    // Register MCP server definition provider
    serverDiscovery.registerWithVSCode(context);
    
    // Register the adaptive tools participant
    registerAdaptiveToolsParticipant(context, toolRegistry, proxyHandlers);
}

function handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
    console.log('Configuration changed, refreshing dynamic tools...');
    
    // The serverDiscovery will automatically refresh when configuration changes
    // due to its event listeners, so we don't need to do anything here
}

function registerCommands(context: vscode.ExtensionContext) {
    // Command to add a new MCP server
    const addServerCommand = vscode.commands.registerCommand('toolsBridger.addMcpServer', async () => {
        const serverId = await vscode.window.showInputBox({
            prompt: 'Enter server ID',
            placeHolder: 'my-server'
        });
        
        if (!serverId) return;
        
        const serverLabel = await vscode.window.showInputBox({
            prompt: 'Enter server label',
            placeHolder: 'My MCP Server'
        });
        
        if (!serverLabel) return;
        
        const transport = await vscode.window.showQuickPick(
            [
                { label: 'stdio', description: 'Standard I/O (for local processes)' },
                { label: 'streamable', description: 'HTTP Streamable (for remote servers) - Coming Soon' },
                { label: 'sse', description: 'Server-Sent Events (for remote servers) - Coming Soon' }
            ],
            { 
                placeHolder: 'Select transport type',
                ignoreFocusOut: true
            }
        );
        
        if (!transport) return;
        
        if (transport.label !== 'stdio') {
            vscode.window.showWarningMessage(`${transport.label} transport is not yet supported. Please use stdio for now.`);
            return;
        }
        
        const serverCommand = await vscode.window.showInputBox({
            prompt: 'Enter server command',
            placeHolder: 'npx @modelcontextprotocol/server-example'
        });
        
        if (!serverCommand) return;
        
        // Optional: Ask for arguments
        const serverArgs = await vscode.window.showInputBox({
            prompt: 'Enter server arguments (optional, space-separated)',
            placeHolder: '-y @modelcontextprotocol/server-postgres'
        });
        
        const args = serverArgs ? serverArgs.split(' ').filter(arg => arg.trim()) : undefined;
        
        serverDiscovery.addServer({
            id: serverId,
            label: serverLabel,
            transport: 'stdio',
            command: serverCommand,
            args: args,
            participantId: 'adaptive-tools-participant.toolsAgent'
        });
        
        vscode.window.showInformationMessage(`Added MCP server: ${serverLabel}`);
    });
    
    // Command to remove an MCP server
    const removeServerCommand = vscode.commands.registerCommand('toolsBridger.removeMcpServer', async () => {
        const servers = serverDiscovery.getServers();
        if (servers.length === 0) {
            vscode.window.showInformationMessage('No MCP servers configured');
            return;
        }
        
        const selectedServer = await vscode.window.showQuickPick(
            servers.map(server => ({
                label: server.label,
                description: server.id,
                server: server
            })),
            { placeHolder: 'Select server to remove' }
        );
        
        if (selectedServer) {
            serverDiscovery.removeServer(selectedServer.server.id);
            vscode.window.showInformationMessage(`Removed MCP server: ${selectedServer.label}`);
        }
    });
    
    // Command to list available tools
    const listToolsCommand = vscode.commands.registerCommand('toolsBridger.listTools', async () => {
        const tools = toolRegistry.getAllTools();
        
        if (tools.length === 0) {
            vscode.window.showInformationMessage('No tools discovered');
            return;
        }
        
        const toolInfo = tools.map(tool => 
            `${tool.name} (${tool.serverId}) - ${tool.participantId}`
        ).join('\n');
        
        const document = await vscode.workspace.openTextDocument({
            content: `Available Tools:\n\n${toolInfo}`,
            language: 'plaintext'
        });
        
        await vscode.window.showTextDocument(document);
    });
    
    context.subscriptions.push(addServerCommand, removeServerCommand, listToolsCommand);
}

export async function deactivate() {
    console.log('VSCode Dynamic Tools Bridger extension is now deactivating...');
    
    try {
        // Cleanup resources
        if (toolRegistry) {
            await toolRegistry.dispose();
        }
        
        console.log('Dynamic Tools Bridger deactivation complete!');
    } catch (error) {
        console.error('Error during deactivation:', error);
    }
}

 