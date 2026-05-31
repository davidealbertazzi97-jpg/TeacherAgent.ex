import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AgentWebSocketBridge } from './AgentWebSocketBridge';
import { FakeAgent } from './FakeAgent';

// Mock WebSockets
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // Connecting
    setTimeout(() => {
      this.readyState = 1; // Open
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data) {
    if (this.onsend) this.onsend(data);
  }

  close() {
    this.readyState = 3; // Closed
    if (this.onclose) this.onclose();
  }
}

global.WebSocket = MockWebSocket;

describe('AgentWebSocketBridge and FakeAgent Client-Side Hardening', () => {
  let sidebarMock;
  let toolBusMock;
  let bridge;

  beforeEach(() => {
    vi.restoreAllMocks();

    toolBusMock = {
      read_project_structure: vi.fn().mockResolvedValue({ ok: true, result: [] }),
      create_page: vi.fn().mockResolvedValue({ ok: true, result: { pageId: 'page-1' } }),
      validate_project: vi.fn().mockResolvedValue({ ok: true, result: { isValid: true } })
    };

    sidebarMock = {
      toolBus: toolBusMock,
      mode: 'assisted',
      token: '',
      logSystem: vi.fn(),
      updateConnectionStatus: vi.fn(),
      appendLocalBubble: vi.fn()
    };

    bridge = new AgentWebSocketBridge(sidebarMock);

    // Mock global fetch for token retrieval
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ token: 'mock-session-uuid-123' })
    });

    // Mock window.confirm
    global.window = global.window || {};
    global.window.confirm = vi.fn().mockReturnValue(true);
  });

  describe('AgentWebSocketBridge Session & Connection', () => {
    it('fetches session token securely from backend and appends to WebSocket query parameter', async () => {
      await bridge.connect('projectId-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/agent-token');
      expect(sidebarMock.token).toBe('mock-session-uuid-123');
      expect(bridge.connected).toBe(true);
      expect(bridge.socket.url).toContain('token=mock-session-uuid-123');
      expect(bridge.socket.url).toContain('role=client');
    });

    it('does not resolve connect() until the WebSocket client is open', async () => {
      const connectPromise = bridge.connect('projectId-wait');

      expect(bridge.connected).toBe(false);

      await connectPromise;

      expect(bridge.connected).toBe(true);
      expect(sidebarMock.updateConnectionStatus).toHaveBeenCalledWith(true);
    });

    it('retrieves configurations securely from electronAPI when available in desktop Electron mode', async () => {
      // Mock window.electronAPI
      global.window.electronAPI = {
        getAgentBridgeConfig: vi.fn().mockResolvedValue({
          wsUrl: 'ws://127.0.0.1:45321/agent-bridge',
          token: 'electron-secure-token-abc',
          projectId: 'project-electron'
        })
      };

      await bridge.connect('project-electron');

      expect(global.window.electronAPI.getAgentBridgeConfig).toHaveBeenCalledWith('project-electron');
      expect(global.fetch).not.toHaveBeenCalled(); // No fallback fetch
      expect(sidebarMock.token).toBe('electron-secure-token-abc');
      expect(bridge.connected).toBe(true);
      expect(bridge.socket.url).toContain('ws://127.0.0.1:45321/agent-bridge');
      expect(bridge.socket.url).toContain('token=electron-secure-token-abc');

      // Clean up mock
      delete global.window.electronAPI;
    });

    it('rejects unsupported or disabled tools (e.g. Yjs snapshots)', async () => {
      const mockCall = { id: 'call-1', tool: 'take_project_snapshot', args: {} };
      bridge.sendResponse = vi.fn();

      await bridge.handleToolCall(mockCall);

      expect(bridge.sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        id: 'call-1',
        ok: false,
        error: expect.stringContaining('is not supported or is disabled')
      }));
    });
  });

  describe('Sidebar Permission Modes (Safe / Assisted / Autonomous)', () => {
    it('blocks mutative tool calls instantly in SAFE mode', async () => {
      sidebarMock.mode = 'safe';
      bridge.sendResponse = vi.fn();

      const mockCall = { id: 'call-2', tool: 'create_page', args: { title: 'Test' } };
      await bridge.handleToolCall(mockCall);

      expect(toolBusMock.create_page).not.toHaveBeenCalled();
      expect(bridge.sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        id: 'call-2',
        ok: false,
        error: expect.stringContaining('mode is SAFE')
      }));
    });

    it('executes mutative tool calls in ASSISTED mode without blocking the external agent loop', async () => {
      sidebarMock.mode = 'assisted';
      global.window.confirm = vi.fn().mockReturnValue(true);
      bridge.sendResponse = vi.fn();

      const mockCall = { id: 'call-3', tool: 'create_page', args: { title: 'Test' } };
      await bridge.handleToolCall(mockCall);

      expect(global.window.confirm).not.toHaveBeenCalled();
      expect(toolBusMock.create_page).toHaveBeenCalled();
      expect(bridge.sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        id: 'call-3',
        ok: true
      }));
    });

    it('supports additional power-user project mutation tools', async () => {
      sidebarMock.mode = 'power-user';
      toolBusMock.rename_page = vi.fn().mockResolvedValue({ ok: true, result: { pageId: 'p1' } });
      bridge.sendResponse = vi.fn();

      const mockCall = { id: 'call-4', tool: 'rename_page', args: { pageId: 'p1', title: 'Renamed' } };
      await bridge.handleToolCall(mockCall);

      expect(toolBusMock.rename_page).toHaveBeenCalled();
      expect(bridge.sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        id: 'call-4',
        ok: true
      }));
    });
  });

  describe('FakeAgent Client & Lifecycle Controls', () => {
    it('constructs valid ws: protocol WebSocket connection url', () => {
      const agent = new FakeAgent('project-123', 'token-123', () => {});
      agent.start();

      expect(agent.socket.url.startsWith('ws://')).toBe(true);
      expect(agent.socket.url).toContain('projectId=project-123');
      expect(agent.socket.url).toContain('token=token-123');
      expect(agent.socket.url).toContain('role=agent');
      agent.stop();
    });

    it('uses explicit desktop broker URL when provided to FakeAgent', () => {
      const agent = new FakeAgent('project-123', 'token-123', () => {}, 'ws://127.0.0.1:45678/agent-bridge');
      agent.start();

      expect(agent.socket.url).toContain('ws://127.0.0.1:45678/agent-bridge');
      expect(agent.socket.url).toContain('projectId=project-123');
      expect(agent.socket.url).toContain('token=token-123');
      agent.stop();
    });

    it('implements tool timeouts rejecting call after 5 seconds', async () => {
      const agent = new FakeAgent('project-123', 'token-123', () => {});
      agent.start();
      agent.connected = true;

      // Mock WebSocket send to do nothing
      agent.socket.send = vi.fn();

      // Trigger callTool which should timeout
      vi.useFakeTimers();
      const promise = agent.callTool('read_project_structure');
      
      // Fast forward 5 seconds
      vi.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow('timed out after 5 seconds');
      vi.useRealTimers();
      agent.stop();
    });

    it('implements stop() cancelling connection, timeouts, and rejecting pending callbacks', async () => {
      const agent = new FakeAgent('project-123', 'token-123', () => {});
      agent.start();
      agent.connected = true;

      // Trigger a callTool promise
      const promise = agent.callTool('read_project_structure');

      // Issue stop command
      agent.stop();

      // Verify that the promise got immediately rejected upon stop
      await expect(promise).rejects.toThrow('stopped by user');
      expect(agent.connected).toBe(false);
      expect(agent.socket).toBeNull();
    });
  });
});
