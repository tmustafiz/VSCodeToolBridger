# Adaptive Tools Bridger for VSCode

An intelligent VSCode extension that provides dynamic MCP (Model Context Protocol) server integration and adaptive chat participants that automatically adjust their expertise based on available tools and user requests.

## Features

- **Dynamic MCP Server Discovery**: Automatically discover and connect to MCP servers
- **Adaptive Chat Participant**: Intelligent assistant that adapts its persona based on available tools
- **Multi-Domain Support**: Handles database, file system, git, web, development, and analysis domains
- **Flexible Configuration**: Configure servers via workspace settings or commands
- **Zero Configuration**: Works out of the box with sensible defaults
- **Real-time Updates**: Add/remove servers without restarting VSCode

## Installation

### From VSIX Package

1. Download the latest `vscode-adaptive-tools-bridger-*.vsix` file
2. Install via command line:
   ```bash
   code --install-extension vscode-adaptive-tools-bridger-*.vsix
   ```
3. Or install via VSCode:
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Run "Extensions: Install from VSIX..."
   - Select the downloaded `.vsix` file

### From Source

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run compile`
4. Package the extension: `npm run package`
5. Install the generated `.vsix` file

## Quick Start

1. **Install the extension** as described above
2. **Open VSCode** - the extension will automatically activate
3. **Open a chat** and type `@toolsAgent` to start using the adaptive assistant
4. **First time setup**: If no MCP servers are configured, it will default to PostgreSQL tools

## Usage

### Chat Commands

Use the `@toolsAgent` chat participant with these commands:

- `@toolsAgent list` - Show available tools by domain
- `@toolsAgent capabilities` - Display current capabilities
- `@toolsAgent servers` - List connected MCP servers
- `@toolsAgent <your question>` - Ask any question (the assistant will adapt to the appropriate domain)

### Examples

```
@toolsAgent list databases in the system
@toolsAgent analyze the user table structure
@toolsAgent help me with git operations
@toolsAgent search for files containing "config"
@toolsAgent what development tools are available?
```

## Configuration

### Method 1: Workspace Settings (Recommended)

Add to your workspace `.vscode/settings.json`:

```json
{
  "toolsBridger.mcpServers": [
    {
      "id": "postgres",
      "label": "PostgreSQL Database",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_URL": "postgresql://user:password@localhost/dbname"
      },
      "participantId": "database",
      "categories": ["database", "postgresql"]
    },
    {
      "id": "filesystem",
      "label": "File System Tools",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {
        "FILESYSTEM_ROOT": "/path/to/your/files"
      },
      "participantId": "filesystem",
      "categories": ["filesystem", "files"]
    }
  ]
}
```

### Method 2: Command Palette

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **"Tools Bridger: Add MCP Server"**
3. Follow the prompts to configure your server

### Method 3: VS Code Settings UI

1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "Tools Bridger"
3. Configure MCP servers in the UI

## Configuration Options

Each MCP server configuration supports:

- `id` (required): Unique identifier for the server
- `label` (required): Display name for the server
- `command` (required): Command to start the server
- `args` (optional): Command line arguments
- `env` (optional): Environment variables
- `participantId` (optional): Chat participant ID (defaults to "toolsAgent")
- `categories` (optional): Tool categories for better organization

## Supported MCP Servers

The extension works with any MCP-compatible server. Popular options include:

- **@modelcontextprotocol/server-postgres** - PostgreSQL database operations
- **@modelcontextprotocol/server-filesystem** - File system operations
- **@modelcontextprotocol/server-git** - Git version control operations
- **@modelcontextprotocol/server-web** - Web scraping and HTTP requests
- **@modelcontextprotocol/server-memory** - Memory and note-taking
- **@modelcontextprotocol/server-docker** - Docker container management

## Domain Adaptation

The extension automatically adapts to different domains based on your requests:

- **Database**: Becomes a database expert when you ask about schemas, queries, or data
- **File System**: Adapts to file operations when you mention files or directories
- **Git**: Becomes a git expert for version control questions
- **Web**: Handles web scraping and HTTP requests
- **Development**: Assists with code analysis and development tools
- **Analysis**: Provides data analysis and reporting capabilities
- **System**: Helps with system administration tasks
- **Security**: Assists with security-related operations

## Commands

Available commands in the Command Palette:

- **Tools Bridger: Add MCP Server** - Add a new MCP server
- **Tools Bridger: Remove MCP Server** - Remove an existing MCP server
- **Tools Bridger: List Available Tools** - Show all discovered tools

## Troubleshooting

### Common Issues

#### Extension Won't Activate

1. Check VSCode version (requires 1.95.0+)
2. Ensure all dependencies are installed
3. Check the Output panel for error messages
4. Try reloading the window (`Ctrl+Shift+P` → "Developer: Reload Window")

#### MCP Server Connection Issues

1. **Check server command**:
   - Verify the command and arguments are correct
   - Test running the command manually in terminal
   - Ensure the server executable is available

2. **Environment variables**:
   - Verify required environment variables are set
   - Check that paths and URLs are correct
   - Ensure databases/services are running

3. **Permissions**:
   - Check file/directory permissions
   - Verify network connectivity
   - Ensure database user has proper permissions

#### No Tools Available

1. **Check server status**:
   - Use `@toolsAgent servers` to see connected servers
   - Verify servers are running and responding
   - Check server logs for error messages

2. **Configuration validation**:
   - Ensure server configurations are valid
   - Check JSON syntax in settings
   - Verify server compatibility with MCP protocol

#### Chat Participant Not Responding

1. **Check participant registration**:
   - Verify extension is activated
   - Try restarting VSCode
   - Check for conflicting extensions

2. **Tool execution issues**:
   - Verify MCP servers are responding
   - Check for network connectivity issues
   - Review error messages in the chat

### Getting Help

If you encounter issues:

1. **Check the Output panel** for detailed error messages
2. **Review server logs** for MCP server-specific issues
3. **Verify configuration** using the command palette tools
4. **Test with default configuration** to isolate issues

### Debug Mode

For detailed troubleshooting:

1. Open Developer Tools (`Help` → `Toggle Developer Tools`)
2. Check the Console for error messages
3. Enable verbose logging in extension settings
4. Review the Extension Host log for detailed information

## Examples and Use Cases

### Database Operations

```
@toolsAgent show me all tables in the database
@toolsAgent describe the users table structure
@toolsAgent find all users created in the last week
@toolsAgent analyze the most common user status values
```

### File System Operations

```
@toolsAgent list all JavaScript files in the project
@toolsAgent find files containing "TODO"
@toolsAgent show me the directory structure
@toolsAgent analyze file sizes in the project
```

### Git Operations

```
@toolsAgent show me recent commits
@toolsAgent what branches are available?
@toolsAgent show me uncommitted changes
@toolsAgent who made the most commits this month?
```

### Mixed Domain Queries

```
@toolsAgent help me analyze the database schema and create documentation
@toolsAgent find all config files and check their git history
@toolsAgent search for SQL queries in the codebase and validate them
```

## Advanced Configuration

### Custom MCP Servers

You can create custom MCP servers by:

1. Implementing the MCP protocol
2. Adding the server to your configuration
3. Defining appropriate categories and capabilities

### Environment-Specific Configuration

Configure different servers for different environments:

```json
{
  "toolsBridger.mcpServers": [
    {
      "id": "dev-postgres",
      "label": "Development Database",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_URL": "postgresql://localhost/myapp_dev"
      }
    },
    {
      "id": "staging-postgres",
      "label": "Staging Database",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_URL": "postgresql://staging-server/myapp_staging"
      }
    }
  ]
}
```

### Performance Optimization

For better performance:

1. Use local servers when possible
2. Configure appropriate timeout values
3. Limit server discovery to needed domains
4. Use caching for frequently accessed data

## Security Considerations

1. **Server Commands**: Only configure trusted MCP servers
2. **Environment Variables**: Be careful with sensitive data in configuration
3. **Network Access**: Ensure servers only access intended resources
4. **Input Validation**: The extension validates inputs, but use trusted servers

## License

MIT License - see LICENSE file for details

## Contributing

For technical details, architecture information, and contribution guidelines, see [TECHNICAL-DOCUMENTATION.md](TECHNICAL-DOCUMENTATION.md).

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

*Transform your VSCode experience with intelligent, adaptive tooling that grows with your needs!*
