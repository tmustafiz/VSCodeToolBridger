# VSCode PostgreSQL Tools Bridger

A Visual Studio Code extension that provides a Chat Participant for PostgreSQL database operations through MCP (Model Context Protocol) servers. This extension allows developers to interact with PostgreSQL databases through natural language using VSCode's Chat interface.

## Features

- **PostgreSQL Chat Participant**: `@dbTools` participant for natural language PostgreSQL database interactions
- **MCP Server Integration**: Connects to PostgreSQL MCP servers using SSE transport
- **10 PostgreSQL Tools**: Comprehensive set of PostgreSQL database tools
- **Safety Features**: Confirmation prompts for destructive database operations
- **Rich Result Formatting**: Query results formatted as markdown tables for easy reading
- **ERD Generation**: Create Mermaid diagrams and JSON representations of database schemas

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile the TypeScript code
4. Open the project in VSCode
5. Press `F5` to run the extension in a new Extension Development Host window

## Configuration

The extension can be configured through VSCode's Settings UI or through workspace settings. The following settings are available:

### Basic Settings

- **`toolsBridger.serverType`**: MCP server transport type
  - `streamable` (default) - Streamable HTTP transport for modern MCP servers (recommended)
  - `sse` - Server-Sent Events (SSE) transport for HTTP-based MCP servers (deprecated)
  - `stdio` - Standard I/O transport for local MCP server processes

- **`toolsBridger.serverUrl`**: URL of the PostgreSQL MCP server (http://localhost:8081/db-mcp-server/)
- **`toolsBridger.serverCommand`**: Command to start the MCP server (stdio only)
- **`toolsBridger.serverArgs`**: Arguments for the MCP server command (stdio only)
- **`toolsBridger.fallbackModel`**: Preferred model when selected model doesn't support tools
  - `auto` (default) - Automatically select the best available tool-capable model
  - `gpt-4.1` - Always use GPT-4.1 as fallback (best quality, superior coding)
  - `gpt-4o` - Always use GPT-4o as fallback (good quality, multimodal)
  - `gpt-4o-mini` - Always use GPT-4o-mini as fallback (faster, good quality)

### Configuration Methods

#### Method 1: VSCode Settings UI (Recommended)
1. Open VSCode Settings (`Cmd/Ctrl + ,`)
2. Search for "PostgreSQL Tools Bridger"
3. Configure the MCP server connection settings

#### Method 2: Workspace Settings (`.vscode/settings.json`)
For Streamable HTTP transport with PostgreSQL MCP server (recommended):
```json
{
  "toolsBridger.serverType": "streamable",
  "toolsBridger.serverUrl": "http://localhost:8081/db-mcp-server/"
}
```

For legacy SSE transport:
```json
{
  "toolsBridger.serverType": "sse",
  "toolsBridger.serverUrl": "http://localhost:8081/db-mcp-server/"
}
```

For stdio transport with local MCP server:
```json
{
  "toolsBridger.serverType": "stdio",
  "toolsBridger.serverCommand": "python3",
  "toolsBridger.serverArgs": ["path/to/your/mcp-server.py"]
}
```

## Supported Models

This extension works with all GitHub Copilot models that support tool calling. The following models are recommended and tested:

### ✅ **Supported Models (with tool calling)**
- **GPT-4.1** - Latest model with superior coding capabilities and 1M token context (when available)
- **GPT-4o** - Recommended for multimodal tasks and general performance
- **GPT-4o-mini** - Recommended for fast interactions
- **Claude 3.5 Sonnet** - Excellent for complex reasoning tasks

### ❌ **Not Supported (no tool calling)**
- **o1-preview** - Reasoning model without tool support
- **o1-mini** - Compact reasoning model without tool support

**Note**: The extension automatically detects o1 models and falls back to a tool-capable model to ensure tool functionality works correctly. You can configure your preferred fallback model in the settings.

### How Model Selection Works

1. **User Selection**: You choose models through VSCode's native chat interface model picker (not through extension settings)
2. **Automatic Fallback**: If you select a model that doesn't support tools (like o1 models), the extension automatically falls back to your configured fallback model
3. **Fallback Priority**: When set to "auto", the extension tries models in this order:
   - GPT-4.1 (best quality, superior coding)
   - GPT-4o (good quality, multimodal)
   - GPT-4o-mini (faster, good quality)
   - GPT-4 (legacy)
   - GPT-3.5-turbo (legacy)

## Usage

1. Configure your PostgreSQL MCP server settings in `.vscode/settings.json`
2. Ensure your PostgreSQL MCP server is running at the configured URL
3. Open a chat session in VSCode
4. Select your preferred supported model from the model picker
5. Use the `@dbTools` participant for PostgreSQL database operations

### Chat Commands

- `@dbTools /list` - List all available PostgreSQL database tools
- `@dbTools /all` - Enable all available PostgreSQL database tools for the conversation
- `@dbTools query the users table` - Natural language PostgreSQL database interactions

### Example Interactions

```
@dbTools show me all schemas in the database
@dbTools list tables in the public schema
@dbTools what columns are in the users table?
@dbTools generate an ERD diagram for the public schema
@dbTools find columns related to "email" in the users table
@dbTools get sample data from the users table email column
@dbTools find tables related to the users table
@dbTools execute SELECT * FROM users LIMIT 10
```

## Available PostgreSQL Tools

The extension provides these 10 PostgreSQL-specific tools that work with PostgreSQL MCP servers:

- **List Schemas** (`postgresql_listSchemas`) - List all available schemas, excluding system schemas
- **List Tables** (`postgresql_listTables`) - List all tables in a specific schema
- **List Columns** (`postgresql_listColumns`) - Get column information with types and nullable status
- **Generate ERD (Mermaid)** (`postgresql_generateErdMermaid`) - Create Mermaid Entity Relationship Diagrams
- **Generate ERD (JSON)** (`postgresql_generateErdJson`) - Generate ERD data as JSON
- **Fuzzy Column Match** (`postgresql_fuzzyColumnMatch`) - Find columns by keyword with similarity matching
- **Sample Column Data** (`postgresql_sampleColumnData`) - Get sample data from specific columns
- **Find Related Tables** (`postgresql_findRelatedTables`) - Find tables related through foreign keys
- **Describe Relationship** (`postgresql_describeRelationship`) - Explain relationships between tables
- **Execute Query** (`postgresql_runQuery`) - Run SELECT queries with safety measures

Each tool provides:

- **Parameter validation** based on TypeScript interfaces
- **Safety confirmations** for destructive operations
- **Rich result formatting** with markdown tables and diagrams
- **Error handling** with helpful error messages

## Project Structure

```
src/
├── extension.ts              # Main extension entry point
├── mcpClient.ts             # MCP client for PostgreSQL server communication
├── databaseParticipant.ts   # PostgreSQL chat participant implementation
├── types.ts                 # TypeScript interfaces and types
└── tools/                   # PostgreSQL tools implementation
    ├── index.ts             # Tools export index
    └── postgresqlTools.ts   # All 10 PostgreSQL tool implementations
```

## Development

### Building

```bash
npm install
npm run compile
```

### Code Quality

This project uses ESLint with modern flat config (`eslint.config.mjs`) following [VSCode extension best practices](https://github.com/microsoft/vscode-extension-samples). Run linting with:

```bash
npm run lint
```

### Architecture Overview

This extension follows the **chat-tools-sample pattern** with these key components:

1. **PostgreSQL Chat Participant** (`databaseParticipant.ts`) - Handles chat interactions and tool orchestration
2. **PostgreSQL Tools** (`tools/postgresqlTools.ts`) - 10 specialized PostgreSQL tools
3. **Type System** (`types.ts`) - Provides TypeScript interfaces for all PostgreSQL tool parameters
4. **MCP Client** (`mcpClient.ts`) - Manages SSE connections to PostgreSQL MCP servers

### Adding Custom Tools

1. Create a new tool file in `src/tools/` (e.g., `src/tools/customTool.ts`)
2. Implement the `vscode.LanguageModelTool<YourInterface>` interface with proper TypeScript interface
3. Export the tool class from `src/tools/index.ts`
4. Register the tool in `src/extension.ts` and add it to `package.json` languageModelTools section

### Tool Development Pattern

```typescript
// Define parameter interface
interface MyToolParams {
  required_param: string;
  optional_param?: number;
}

// Implement tool class
export class MyTool implements vscode.LanguageModelTool<MyToolParams> {
  constructor(private mcpClient: McpClient) {}
  
  async invoke(options: vscode.LanguageModelToolInvocationOptions<MyToolParams>, token: vscode.CancellationToken) {
    // Implementation with type safety
  }
}
```

### Testing

```bash
npm run test
```

### Packaging

```bash
npm run package
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure compilation succeeds
5. Submit a pull request

## License

This project is licensed under the MIT License.
