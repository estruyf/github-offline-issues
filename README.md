<div align="center">
  <img src="app-icon.png" alt="GitHub Offline Issues Icon" width="128" height="128">
                            
  # GitHub Offline Issues
                            
  **A desktop application built with Tauri that lets you take your GitHub issues
  offline. Perfect for when you're commuting on a plane, train, or anywhere
  without connectivity.**
                            
                          
                        
                      
                    
                  
                
              
            
          
        
      
    
  
  [![macOS](https://img.shields.io/badge/macOS-10.15+-blue.svg)](https://www.apple.com/macos/)
  [![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB.svg)](https://tauri.app/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19.1-61DAFB.svg)](https://reactjs.org/)
                            
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
</div>

## Features

- **GitHub Authentication** - Sign in with your GitHub Personal Access Token
- **Repository Management** - Add and manage multiple repositories
- **Offline Sync** - Download all issues and comments for offline access
- **Incremental Sync** - Quick sync to fetch only changes since last sync
- **Search & Filter** - Find issues by title, body, or number; filter by
  open/closed state
- **Full Issue Details** - View complete issue content including labels,
  assignees, milestones, and comments with proper Markdown rendering
- **Offline Replies** - Write replies to issues while offline, automatically
  published on next sync
- **Local Issue Creation** - Create new issues locally that get published when
  you sync

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install)
- [GitHub Personal Access Token](https://github.com/settings/tokens) with `repo`
  scope

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Usage

1. Launch the app and enter your GitHub Personal Access Token
2. Add repositories you want to access offline
3. Click "Take Offline" to sync issues and comments
4. Browse your issues anytime, even without internet!

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, React Router
- **Backend**: Rust, Tauri v2
- **Storage**: tauri-plugin-store (local persistence)
- **API**: tauri-plugin-http (GitHub API integration)

## Development

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

MIT
