import * as vscode from 'vscode';

export interface McpServerConfig {
    id: string;
    label: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    participantId?: string;
    categories?: string[];
}

export class McpServerDiscovery {
    private readonly didChangeEmitter = new vscode.EventEmitter<void>();
    private servers: McpServerConfig[] = [];
    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadServersFromConfig();
    }

    public get onDidChangeMcpServerDefinitions(): vscode.Event<void> {
        return this.didChangeEmitter.event;
    }

    public async provideMcpServerDefinitions(): Promise<vscode.McpServerDefinition[]> {
        const definitions: vscode.McpServerDefinition[] = [];

        for (const server of this.servers) {
            try {
                const definition = new vscode.McpStdioServerDefinition(
                    server.label,
                    server.command,
                    server.args || [],
                    server.env || {}
                );
                definitions.push(definition);
            } catch (error) {
                console.error(`Error creating server definition for ${server.id}:`, error);
            }
        }

        return definitions;
    }

    public addServer(config: McpServerConfig): void {
        // Check if server already exists
        const existingIndex = this.servers.findIndex(s => s.id === config.id);
        if (existingIndex >= 0) {
            this.servers[existingIndex] = config;
        } else {
            this.servers.push(config);
        }
        
        this.saveServersToConfig();
        this.didChangeEmitter.fire();
    }

    public removeServer(serverId: string): void {
        const initialLength = this.servers.length;
        this.servers = this.servers.filter(s => s.id !== serverId);
        
        if (this.servers.length !== initialLength) {
            this.saveServersToConfig();
            this.didChangeEmitter.fire();
        }
    }

    public getServers(): McpServerConfig[] {
        return [...this.servers];
    }

    public getServerById(serverId: string): McpServerConfig | undefined {
        return this.servers.find(s => s.id === serverId);
    }

    private loadServersFromConfig(): void {
        try {
            // Load from workspace configuration
            const config = vscode.workspace.getConfiguration('toolsBridger');
            const configuredServers = config.get<McpServerConfig[]>('mcpServers', []);
            
            // Load from global state (user-added servers)
            const globalServers = this.context.globalState.get<McpServerConfig[]>('mcpServers', []);
            
            // Merge servers (global state takes precedence)
            const allServers = [...configuredServers];
            for (const globalServer of globalServers) {
                const existingIndex = allServers.findIndex(s => s.id === globalServer.id);
                if (existingIndex >= 0) {
                    allServers[existingIndex] = globalServer;
                } else {
                    allServers.push(globalServer);
                }
            }

            this.servers = allServers;

            // Add default PostgreSQL server if none configured
            if (this.servers.length === 0) {
                this.addDefaultPostgresServer();
            }
        } catch (error) {
            console.error('Error loading MCP servers from config:', error);
            this.addDefaultPostgresServer();
        }
    }

    private saveServersToConfig(): void {
        try {
            this.context.globalState.update('mcpServers', this.servers);
        } catch (error) {
            console.error('Error saving MCP servers to config:', error);
        }
    }

    private addDefaultPostgresServer(): void {
        // Add a default PostgreSQL server configuration
        const defaultServer: McpServerConfig = {
            id: 'default-postgres',
            label: 'PostgreSQL Database Tools',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-postgres'],
            env: {},
            participantId: 'adaptive-tools-participant.toolsAgent',
            categories: ['database', 'postgresql']
        };
        
        this.servers.push(defaultServer);
    }

    public registerWithVSCode(context: vscode.ExtensionContext): void {
        // Register the MCP server definition provider
        const disposable = vscode.lm.registerMcpServerDefinitionProvider('toolsBridger', {
            onDidChangeMcpServerDefinitions: this.onDidChangeMcpServerDefinitions,
            provideMcpServerDefinitions: () => this.provideMcpServerDefinitions()
        });

        context.subscriptions.push(disposable);
    }
} 