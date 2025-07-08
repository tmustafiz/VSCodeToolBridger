import * as vscode from 'vscode';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema, ListToolsResultSchema, Tool } from '@modelcontextprotocol/sdk/types.js';

export interface McpClientConfig {
  mcpServerUrl: string;
  authToken?: string;
  timeout?: number;
  retries?: number;
  allowInsecure?: boolean;
}

export class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport | null = null;
  private connected: boolean = false;

  constructor() {
    // Configuration will be read when connecting
  }

  updateConfiguration() {
    // Configuration will be read when connecting
  }


  /** Initialize MCP connection */
  async connect() {
    if (this.connected) {
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration('toolsBridger');
      const serverType = config.get<string>('serverType', 'stdio');

      if (serverType === 'stdio') {
        await this.connectStdio();
      } else if (serverType === 'sse') {
        await this.connectSSE();
      } else if (serverType === 'streamable') {
        await this.connectStreamable();
      } else {
        throw new Error(`Unsupported server type: ${serverType}`);
      }

      this.connected = true;
      console.log('MCP client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MCP client:', error);
      throw error;
    }
  }

  private async connectStdio() {
    const config = vscode.workspace.getConfiguration('toolsBridger');
    const serverCommand = config.get<string>('serverCommand', '');
    const serverArgs = config.get<string[]>('serverArgs', []);

    if (!serverCommand) {
      throw new Error('Server command is required for stdio transport');
    }

    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs
    });

    this.client = new Client({
      name: 'vscode-database-tools',
      version: '0.0.1'
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
  }

  private async connectSSE() {
    const config = vscode.workspace.getConfiguration('toolsBridger');
    const serverUrl = config.get<string>('serverUrl', '');

    if (!serverUrl) {
      throw new Error('Server URL is required for SSE transport');
    }

    this.transport = new SSEClientTransport(new URL(serverUrl));

    this.client = new Client({
      name: 'vscode-database-tools',
      version: '0.0.1'
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
  }

  private async connectStreamable() {
    const config = vscode.workspace.getConfiguration('toolsBridger');
    const serverUrl = config.get<string>('serverUrl', '');

    if (!serverUrl) {
      throw new Error('Server URL is required for Streamable HTTP transport');
    }

    this.transport = new StreamableHTTPClientTransport(new URL(serverUrl));

    this.client = new Client({
      name: 'vscode-database-tools',
      version: '0.0.1'
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
  }

  /** Check if client is connected */
  isConnected(): boolean {
    return this.connected;
  }

  /** Get the underlying MCP client for direct access */
  getClient(): Client {
    if (!this.client) {
      throw new Error('MCP client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /** List available tools from the MCP server */
  async listTools(): Promise<Tool[]> {
    if (!this.client) {
      throw new Error('MCP client not initialized. Call connect() first.');
    }

    try {
      const result = await this.client.listTools();
      return result.tools || [];
    } catch (error) {
      console.error('Failed to list tools from MCP server:', error);
      throw error;
    }
  }

  /** Call an MCP tool and return result */
  async json<T = unknown>(toolName: string, params: any): Promise<T> {
    if (!this.client) {
      throw new Error('MCP client not initialized. Call connect() first.');
    }

    try {
      // Use the dedicated callTool method instead of manual request construction
      const result = await this.client.callTool({
        name: toolName,
        arguments: params
      }, CallToolResultSchema);

      // Extract the result content
      if (result && result.content && Array.isArray(result.content) && result.content.length > 0) {
        const firstContent = result.content[0];
        if (firstContent.type === 'text') {
          return firstContent.text as T;
        }
      }
      
      return result as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Tool call failed for ${toolName}:`, {
        toolName,
        params,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`MCP tool call failed for ${toolName}: ${errorMessage}`);
    }
  }

  /** Call an MCP tool with streaming support */
  async stream<T = unknown>(toolName: string, params: any, onChunk: (data: T) => void) {
    if (!this.client) {
      throw new Error('MCP client not initialized. Call connect() first.');
    }

    try {
      // Use the dedicated callTool method instead of manual request construction
      const result = await this.client.callTool({
        name: toolName,
        arguments: params
      }, CallToolResultSchema);

      // Handle the result content
      if (result && result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text') {
            onChunk(item.text as T);
          }
        }
      }

      return () => {
        // Cancel function - the SDK handles cleanup automatically
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Streaming tool call failed for ${toolName}:`, {
        toolName,
        params,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`MCP streaming tool call failed for ${toolName}: ${errorMessage}`);
    }
  }

  /** Disconnect from MCP server */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.connected = false;
  }
}