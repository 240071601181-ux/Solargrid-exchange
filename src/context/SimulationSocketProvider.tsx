import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WS_URL } from "../api/client";
import { queryKeys } from "../api/queryKeys";

export type SocketStatus = "connecting" | "connected" | "reconnecting" | "offline" | "disabled";

export interface SimulationSocketValue {
  status: SocketStatus;
  lastEventAt: string | null;
  lastError: string | null;
  reconnectAttempt: number;
  reconnect: () => void;
}

export const SimulationSocketContext = createContext<SimulationSocketValue | null>(null);

const MAX_BACKOFF_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

const EVENT_INVALIDATION: Record<string, string[][]> = {
  "simulation.state_updated": [
    queryKeys.simulation as unknown as string[],
    queryKeys.households as unknown as string[],
    queryKeys.optimization as unknown as string[],
    ["transactions"],
    ["pricing"],
  ],
  "simulation.status": [queryKeys.simulation as unknown as string[], queryKeys.households as unknown as string[]],
  "simulation.error": [queryKeys.simulation as unknown as string[]],
  "pricing.updated": [queryKeys.simulation as unknown as string[], ["pricing"]],
  "forecast.updated": [["forecast"]],
  "optimization.completed": [
    queryKeys.optimization as unknown as string[],
    queryKeys.simulation as unknown as string[],
    ["transactions"],
  ],
  "transaction.created": [["transactions"], queryKeys.simulation as unknown as string[], ["optimization"]],
  "transaction.updated": [["transactions"], queryKeys.simulation as unknown as string[]],
  "scenario.started": [queryKeys.simulation as unknown as string[]],
  "scenario.completed": [queryKeys.simulation as unknown as string[]],
  "settings.updated": [queryKeys.settings as unknown as string[], queryKeys.simulation as unknown as string[]],
  "evaluation.completed": [queryKeys.evaluation as unknown as string[]],
};

function backoffDelay(attempt: number): number {
  const base = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** Math.min(attempt, 5));
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

export function SimulationSocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>(WS_URL ? "connecting" : "disabled");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const closedRef = useRef(false);
  const lastSeqRef = useRef(0);
  const connectRef = useRef<() => void>(() => undefined);

  const invalidateForEvent = useCallback(
    (type: string) => {
      const keys = EVENT_INVALIDATION[type];
      if (!keys) return;
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [queryClient],
  );

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (closedRef.current || !WS_URL) return;
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearTimers();
    setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");
    setLastError(null);

    let socket: WebSocket;
    try {
      socket = new WebSocket(WS_URL);
    } catch (error) {
      setStatus("offline");
      setLastError(error instanceof Error ? error.message : "Could not open the simulation socket");
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      attemptRef.current = 0;
      setReconnectAttempt(0);
      setStatus("connected");
      setLastError(null);
      setLastEventAt(new Date().toISOString());
      void queryClient.invalidateQueries({ queryKey: queryKeys.simulation });
      void queryClient.invalidateQueries({ queryKey: queryKeys.households });
      pingTimerRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send("ping");
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = (message: MessageEvent<string>) => {
      setLastEventAt(new Date().toISOString());
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.data);
      } catch {
        console.warn("Ignored a malformed simulation event.");
        return;
      }
      if (typeof parsed !== "object" || parsed === null) return;
      const event = parsed as { type?: unknown; seq?: unknown };
      if (typeof event.type !== "string") return;
      const seq = typeof event.seq === "number" ? event.seq : 0;

      if (event.type === "pong") return;
      if (seq > 0 && event.type !== "settings.updated") {
        if (seq < lastSeqRef.current) return;
        lastSeqRef.current = seq;
      }
      invalidateForEvent(event.type);
    };

    socket.onerror = () => {
      setLastError("The realtime connection reported an error.");
    };

    socket.onclose = () => {
      socketRef.current = null;
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      if (closedRef.current) return;
      attemptRef.current += 1;
      setReconnectAttempt(attemptRef.current);
      setStatus("reconnecting");
      const delay = backoffDelay(attemptRef.current - 1);
      reconnectTimerRef.current = window.setTimeout(() => {
        connectRef.current();
      }, delay);
    };
  }, [clearTimers, invalidateForEvent, queryClient]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    closedRef.current = false;
    // Establishes the external WebSocket subscription; connection status is React state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();

    const handleOnline = () => {
      if (closedRef.current) return;
      attemptRef.current = 0;
      setReconnectAttempt(0);
      connectRef.current();
    };
    const handleOffline = () => {
      setStatus("offline");
      setLastError("Browser is offline. Realtime updates are paused.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      closedRef.current = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimers();
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close(1000, "Application unmounted");
      }
    };
  }, [clearTimers, connect]);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    setReconnectAttempt(0);
    setLastError(null);
    const socket = socketRef.current;
    if (socket) {
      socket.onclose = null;
      socket.close();
      socketRef.current = null;
    }
    clearTimers();
    connectRef.current();
  }, [clearTimers]);

  const value = useMemo<SimulationSocketValue>(
    () => ({ status, lastEventAt, lastError, reconnectAttempt, reconnect }),
    [status, lastEventAt, lastError, reconnectAttempt, reconnect],
  );

  return <SimulationSocketContext.Provider value={value}>{children}</SimulationSocketContext.Provider>;
}
