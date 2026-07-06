# Android Code Search MCP Server

[![npm version](https://img.shields.io/npm/v/cs-android-mcp)](https://www.npmjs.com/package/cs-android-mcp)
[![npm downloads](https://img.shields.io/npm/dm/cs-android-mcp)](https://www.npmjs.com/package/cs-android-mcp)
[![GitHub stars](https://img.shields.io/github/stars/steveday763/cs_android_mcp)](https://github.com/steveday763/cs_android_mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

English | [简体中文](README_zh-CN.md)

A Model Context Protocol (MCP) server for searching and browsing Android source code via cs.android.com.

## Preview

![Preview](preview.png)

## Features

- **Code Search**: Search through Android source code with regex support
- **File Content**: Retrieve full source file contents
- **Symbol Suggestions**: Get autocomplete suggestions for classes, methods, files
- **Multiple Projects**: Search across Android, AndroidX, Android Studio, and LLVM projects

## Installation

### Claude Code

```bash
claude mcp add cs-android -- npx -y cs-android-mcp
```

### Cursor

```json
{
  "mcpServers": {
    "cs-android": {
      "command": "npx",
      "args": ["-y", "cs-android-mcp"]
    }
  }
}
```

### Other MCP Clients

Any MCP-compatible client can use the stdio transport:

```bash
npx -y cs-android-mcp
```

Or install globally:

```bash
npm install -g cs-android-mcp
cs-android-mcp
```

## Available Tools

### search_android_code

Search for code in Android source repositories.

| Parameter | Required | Description |
|---|---|---|
| `query` | Yes | Search query (supports regex, `file:`, `class:`, `function:` operators) |
| `project` | No | Filter by project: `android`, `androidx`, `android-studio`, `android-llvm` |
| `pageSize` | No | Number of results (default: 10, max: 50) |
| `contextLines` | No | Context lines around matches (default: 1) |

### get_file_content

Get the full content of a source file.

| Parameter | Required | Description |
|---|---|---|
| `project` | Yes | Project name |
| `repository` | Yes | Repository path |
| `branch` | Yes | Branch name |
| `path` | Yes | File path |

### suggest_symbols

Get symbol suggestions for partial queries.

| Parameter | Required | Description |
|---|---|---|
| `query` | Yes | Partial query |
| `maxResults` | No | Max suggestions (default: 7) |

### list_projects

List all available Android source projects.

## License

MIT
