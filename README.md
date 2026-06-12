<div align="center">
  <img src="public/images/logo_readme.png" alt="TeacherAgent-ex Logo" height="200">

  <h1 align="center">TeacherAgent-ex</h1>

  <p align="center">
    <strong>TeacherAgent-ex</strong> is an AI-powered, AGPL-licensed educational authoring tool designed to create and publish interactive educational resources.
    <br />
    <em>TeacherAgent-ex is an independent fork based on the eXeLearning project.</em>
  </p>
</div>

---

## About the Project

**TeacherAgent-ex** (Teacher + AI Agent + eX) is a next-generation fork of eXeLearning. While retaining the core structure, formats, and compatibility of the original project, it introduces **advanced AI agent coordination** to help teachers design premium interactive resources through normal language conversation.

### 🌟 Key AI Capabilities

*   **Stay-Alive Chat Loop:** A persistent, concurrent chat session in the sidebar. The AI agent stays connected to the editing workspace, allowing teachers to continuously iterate, improve, and format the same content without losing context.
*   **HTML5 Game Mimicking:** Advanced prompt patterns allow the AI to construct premium interactive mini-games (such as 3D card flips memory games, crosswords, word search puzzles, drag-and-drop connectors) inside standard blocks with elegant styles, animations, and state machines.
*   **Remote Image Proxy Downloader:** A specialized tool that automatically downloads remote images (including resolving Wikipedia file pages to their direct JPG/PNG files) and saves them locally in the `AI_Downloads/` folder of the project assets, bypassing CORS and CDN issues.
*   **Authorization Safety Mode:** An optional interactive permission system that displays a prompt in the chat whenever an agent wants to perform editing actions, letting the teacher approve or reject changes in real time.

---

## Technology Stack

TeacherAgent-ex is built on a high-performance modern web stack:

1.  **Backend:** [Elysia Framework](https://elysiajs.com/) running on [Bun](https://bun.sh/).
2.  **Database:** [Kysely](https://kysely.dev/) query builder supporting SQLite, MySQL, and PostgreSQL.
3.  **Real-Time Sync:** [Yjs](https://yjs.dev/) CRDTs and WebSocket adapters for interactive operations and rollback snapshots.
4.  **Desktop Wrapper:** [Electron](https://www.electronjs.org/) for a native offline authoring environment on Linux, macOS, and Windows.
5.  **Styling:** Custom Vanilla CSS and Bootstrap.

---

## Quick Start

### 1. Launching the Desktop Client (Recommended)

You can launch the Electron desktop application directly using the start script:

```bash
./teacheragent-ex-start.sh --desktop
```

This script will verify dependencies, build the static assets, and spawn the Electron environment. Alternatively, you can click on the launcher icon created on your Desktop (**TeacherAgent-ex.desktop**).

### 2. Local Web Development (Bun)

For developers working on the server and client-side code:

```bash
./teacheragent-ex-start.sh --web-local
```

This will run the backend on Bun and serve the editor locally at `http://localhost:8080` with hot reload enabled.

### 3. Running with Docker Compose

To launch the multi-user web environment inside Docker containers:

```bash
./teacheragent-ex-start.sh --web-docker
```

---

## Legal Notices & Licensing

TeacherAgent-ex is licensed under the **GNU Affero General Public License v3.0 (or later)**.

### Credits & Disclaimers
*   **TeacherAgent-ex** is an independent, community-driven project and is **not affiliated with, sponsored by, or endorsed** by the official eXeLearning project or its maintainers (Cedec-INTEF / Junta de Extremadura / University of Auckland / eXe Project).
*   The original codebase, file packaging standards (`.elp`, `.elpx`), and legacy styles are copyright their respective original authors and projects. We preserve all copyright notices inside the code and the **Legal Notes** dialog of the application.
*   In accordance with Section 13 of the GNU AGPLv3, the full source code of all modifications made to this software is publicly available to all users.
