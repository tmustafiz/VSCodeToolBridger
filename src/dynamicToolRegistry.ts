import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { McpServerDiscovery, McpServerConfig } from './mcpServerDiscovery';

export interface DiscoveredTool {
    name: string;
    serverId: string;
    participantId: string;
    schema: any;
    description?: string;
    category?: string;
    inputSchema?: any;
}

export interface ToolExecutionContext {
    toolName: string;
    serverId: string;
    participantId: string;
    arguments: any;
    token: vscode.CancellationToken;
}

export class DynamicToolRegistry {
    private readonly discoveredTools = new Map<string, DiscoveredTool>();
    private readonly serverClients = new Map<string, McpClient>();
    private readonly serverDiscovery: McpServerDiscovery;
    private readonly context: vscode.ExtensionContext;
    private readonly didChangeEmitter = new vscode.EventEmitter<void>();

    constructor(context: vscode.ExtensionContext, serverDiscovery: McpServerDiscovery) {
        this.context = context;
        this.serverDiscovery = serverDiscovery;
        this.initializeRegistry();
    }

    public get onDidChangeTools(): vscode.Event<void> {
        return this.didChangeEmitter.event;
    }

    private async initializeRegistry(): Promise<void> {
        // Listen for server changes
        this.serverDiscovery.onDidChangeMcpServerDefinitions(() => {
            this.refreshToolDiscovery();
        });

        // Initial tool discovery
        await this.refreshToolDiscovery();
    }

    private async refreshToolDiscovery(): Promise<void> {
        try {
            console.log('Refreshing tool discovery...');
            
            // Clear existing tools
            this.discoveredTools.clear();
            
            // Dispose old clients
            for (const client of this.serverClients.values()) {
                await client.disconnect();
            }
            this.serverClients.clear();

            // Discover tools from all configured servers
            const servers = this.serverDiscovery.getServers();
            for (const server of servers) {
                await this.discoverToolsFromServer(server);
            }

            this.didChangeEmitter.fire();
        } catch (error) {
            console.error('Error refreshing tool discovery:', error);
        }
    }

    private async discoverToolsFromServer(serverConfig: McpServerConfig): Promise<void> {
        try {
            console.log(`Discovering tools from server: ${serverConfig.id}`);
            
            // Create MCP client for this server
            const client = new McpClient();
            
            this.serverClients.set(serverConfig.id, client);
            
            // Connect and discover tools
            await client.connect();
            
            if (!client.isConnected()) {
                console.warn(`Failed to connect to server: ${serverConfig.id}`);
                return;
            }

            // List available tools
            const tools = await client.listTools();
            
            if (!tools || !Array.isArray(tools) || tools.length === 0) {
                console.warn(`No tools found in server: ${serverConfig.id}`);
                return;
            }

            // Register discovered tools
            for (const tool of tools) {
                const discoveredTool: DiscoveredTool = {
                    name: tool.name,
                    serverId: serverConfig.id,
                    participantId: serverConfig.participantId || 'toolsAgent',
                    schema: tool.inputSchema || {},
                    description: tool.description,
                    category: this.categorizeTools(tool.name, serverConfig.categories),
                    inputSchema: tool.inputSchema
                };

                // Store tool with full identifier
                const toolKey = `${serverConfig.id}:${tool.name}`;
                this.discoveredTools.set(toolKey, discoveredTool);
                
                console.log(`Registered tool: ${toolKey} for participant: ${discoveredTool.participantId}`);
            }

        } catch (error) {
            console.error(`Error discovering tools from server ${serverConfig.id}:`, error);
        }
    }

    private categorizeTools(toolName: string, serverCategories?: string[]): string {
        if (serverCategories && serverCategories.length > 0) {
            return serverCategories[0];
        }

        // Auto-categorize based on tool name patterns
        const name = toolName.toLowerCase();
        
        if (name.includes('list') || name.includes('get') || name.includes('describe')) {
            return 'query';
        }
        
        if (name.includes('generate') || name.includes('create') || name.includes('build')) {
            return 'analysis';
        }
        
        if (name.includes('run') || name.includes('execute') || name.includes('query')) {
            return 'database';
        }
        
        return 'general';
    }

    public async executeProxyTool(context: ToolExecutionContext): Promise<any> {
        const toolKey = `${context.serverId}:${context.toolName}`;
        const tool = this.discoveredTools.get(toolKey);
        
        if (!tool) {
            throw new Error(`Tool not found: ${context.toolName} in server ${context.serverId}`);
        }

        const client = this.serverClients.get(context.serverId);
        if (!client || !client.isConnected()) {
            throw new Error(`Server not connected: ${context.serverId}`);
        }

        try {
            // Execute the tool via MCP client
            const result = await client.json(context.toolName, context.arguments);
            
            return {
                success: true,
                result: result,
                toolName: context.toolName,
                serverId: context.serverId
            };
            
        } catch (error) {
            console.error(`Error executing tool ${context.toolName}:`, error);
            throw new Error(`Failed to execute tool ${context.toolName}: ${error}`);
        }
    }

    public getToolsForParticipant(participantId: string): DiscoveredTool[] {
        const tools: DiscoveredTool[] = [];
        
        for (const tool of this.discoveredTools.values()) {
            if (tool.participantId === participantId) {
                tools.push(tool);
            }
        }
        
        return tools;
    }

    public getAllTools(): DiscoveredTool[] {
        return Array.from(this.discoveredTools.values());
    }

    public getToolByName(toolName: string, participantId?: string): DiscoveredTool | undefined {
        for (const tool of this.discoveredTools.values()) {
            if (tool.name === toolName && (!participantId || tool.participantId === participantId)) {
                return tool;
            }
        }
        return undefined;
    }

    public getAvailableParticipants(): string[] {
        const participants = new Set<string>();
        for (const tool of this.discoveredTools.values()) {
            participants.add(tool.participantId);
        }
        return Array.from(participants);
    }

    public getToolsByCategory(category: string): DiscoveredTool[] {
        const tools: DiscoveredTool[] = [];
        
        for (const tool of this.discoveredTools.values()) {
            if (tool.category === category) {
                tools.push(tool);
            }
        }
        
        return tools;
    }

    public async dispose(): Promise<void> {
        // Disconnect all clients
        for (const client of this.serverClients.values()) {
            await client.disconnect();
        }
        
        this.serverClients.clear();
        this.discoveredTools.clear();
        this.didChangeEmitter.dispose();
    }
} 