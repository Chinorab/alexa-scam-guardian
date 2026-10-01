/**
 * MCP Apps host for the simulated Echo Show (T051). Each card is an MCP Apps view from the
 * MCP server, loaded in a sandboxed iframe (opaque origin) and fed its tool result through
 * the official AppBridge over postMessage.
 */
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Card } from "./api";

const HOST_INFO = { name: "Simulated Echo Show", version: "0.1.0" };

const TITLES: Record<string, string> = {
  "ui://guardian/warning-signs": "Warning signs",
  "ui://guardian/check-status": "Check status",
  "ui://guardian/report": "Report summary",
};

export function McpAppFrame(props: { deviceId: string; card: Card }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    let bridge: AppBridge | undefined;

    const connect = async () => {
      const target = iframe.contentWindow;
      if (!target) return;
      bridge = new AppBridge(null, HOST_INFO, {});
      bridge.onsizechange = ({ height: next }) => {
        if (typeof next === "number" && next > 0) setHeight(Math.min(Math.ceil(next), 900));
      };
      bridge.oninitialized = () => {
        void bridge?.sendToolInput({ arguments: {} });
        void bridge?.sendToolResult({ content: [], structuredContent: props.card.data });
      };
      await bridge.connect(new PostMessageTransport(target, target));
    };

    // Connect before the view loads: its contentWindow proxy is stable across navigation,
    // and the view's ui/initialize may arrive as soon as its script runs.
    void connect();
    return () => {
      void bridge?.close();
    };
  }, [props.card]);

  const src = `/frame/${encodeURIComponent(props.deviceId)}?uri=${encodeURIComponent(props.card.uri)}`;
  return (
    <iframe
      ref={frame}
      class="mcp-app-frame"
      title={TITLES[props.card.uri] ?? "Screen card"}
      sandbox="allow-scripts"
      src={src}
      style={{ height: `${height}px` }}
    />
  );
}
