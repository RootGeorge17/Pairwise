import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import type { editor as MonacoEditorNamespace } from "monaco-editor";
import { fetchWithAuth, getAccessToken } from "../lib/authApi";

type MonacoEditor = MonacoEditorNamespace.IStandaloneCodeEditor;

export type LobbyConnectionState =
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "error";

type SnapshotLoader = (lobbyId: number) => Promise<Uint8Array | null>;
type SnapshotSaver = (lobbyId: number, snapshot: Uint8Array, plainText: string | null) => Promise<void>;

export type UseLobbyCollaborationOptions = {
    lobbyId: number | null;
    currentUserId?: number | null;
    snapshotDebounceMs?: number;
    initialPlainText?: string | null;
    allowInitialPlainTextSeed?: boolean;
    initialPlainTextSeedDelayMs?: number;
    loadSnapshot?: SnapshotLoader;
    saveSnapshot?: SnapshotSaver;
};

export type UseLobbyCollaborationResult = {
    editorReady: boolean;
    connectionState: LobbyConnectionState;
    cursorPresenceByUserId: Record<number, LobbyCursorPresence>;
    latestExecutionEvent: LobbyExecutionEvent | null;
    bindEditor: (monacoEditor: MonacoEditor, monacoLib: unknown) => void;
    sendExecutionEvent: (event: LobbyExecutionEvent) => void;
    getCurrentSharedText: () => string;
    disconnect: () => void;
};

export type LobbyCursorPresence = {
    line: number;
    column: number;
    selectionStartLine: number;
    selectionStartColumn: number;
    selectionEndLine: number;
    selectionEndColumn: number;
    updatedAt: number;
};

export type LobbyExecutionEvent = {
    mode: "run" | "submit";
    phase: "started" | "finished";
    actorUserId: number | null;
    errorMessage?: string | null;
    result?: unknown;
    updatedAt: number;
};

const DEFAULT_SNAPSHOT_DEBOUNCE_MS = 3000;
const DEFAULT_INITIAL_TEXT_SEED_DELAY_MS = 1000;
const MSG_UPDATE = 0;
const MSG_SYNC_REQUEST = 1;
const MSG_SYNC_REPLY = 2;
const MSG_EXECUTION_EVENT = 3;

function encodeFramedMessage(messageType: number, payload: Uint8Array): Uint8Array {
    const framed = new Uint8Array(1 + payload.length);
    framed[0] = messageType;
    framed.set(payload, 1);
    return framed;
}

function encodeExecutionEventMessage(event: LobbyExecutionEvent): Uint8Array {
    const payload = new TextEncoder().encode(JSON.stringify(event));
    return encodeFramedMessage(MSG_EXECUTION_EVENT, payload);
}

function parseExecutionEvent(payload: Uint8Array): LobbyExecutionEvent | null {
    if (payload.length === 0) {
        return null;
    }

    try {
        const parsed = JSON.parse(new TextDecoder().decode(payload)) as Partial<LobbyExecutionEvent>;
        if (
            !parsed
            || (parsed.mode !== "run" && parsed.mode !== "submit")
            || (parsed.phase !== "started" && parsed.phase !== "finished")
        ) {
            return null;
        }

        return {
            mode: parsed.mode,
            phase: parsed.phase,
            actorUserId: typeof parsed.actorUserId === "number" ? parsed.actorUserId : null,
            errorMessage: typeof parsed.errorMessage === "string" ? parsed.errorMessage : null,
            result: parsed.result ?? null,
            updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
        };
    } catch {
        return null;
    }
}

function resolveWsBaseUrl(): string {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

    if (apiBaseUrl && apiBaseUrl.length > 0) {
        const url = new URL(apiBaseUrl);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.pathname = "";
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/$/, "");
    }

    const { protocol, hostname, port } = window.location;
    const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
    const backendPort = port === "5173" ? "8080" : port;
    return `${wsProtocol}//${hostname}${backendPort ? `:${backendPort}` : ""}`;
}

async function defaultLoadSnapshot(lobbyId: number): Promise<Uint8Array | null> {
    const response = await fetchWithAuth(`/api/lobbies/${lobbyId}/document`);
    if (!response.ok) {
        return null;
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
}

async function defaultSaveSnapshot(lobbyId: number, snapshot: Uint8Array, plainText: string | null): Promise<void> {
    void plainText;
    const normalizedSnapshot = Uint8Array.from(snapshot);
    await fetchWithAuth(`/api/lobbies/${lobbyId}/document`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/octet-stream",
        },
        body: new Blob([normalizedSnapshot.buffer], { type: "application/octet-stream" }),
    });
}

export function useLobbyCollaboration(options: UseLobbyCollaborationOptions): UseLobbyCollaborationResult {
    const {
        lobbyId,
        currentUserId = null,
        snapshotDebounceMs = DEFAULT_SNAPSHOT_DEBOUNCE_MS,
        initialPlainText = null,
        allowInitialPlainTextSeed = false,
        initialPlainTextSeedDelayMs = DEFAULT_INITIAL_TEXT_SEED_DELAY_MS,
        loadSnapshot = defaultLoadSnapshot,
        saveSnapshot = defaultSaveSnapshot,
    } = options;

    const [editorReady, setEditorReady] = useState(false);
    const [connectionState, setConnectionState] = useState<LobbyConnectionState>("idle");
    const [cursorPresenceByUserId, setCursorPresenceByUserId] = useState<Record<number, LobbyCursorPresence>>({});
    const [latestExecutionEvent, setLatestExecutionEvent] = useState<LobbyExecutionEvent | null>(null);

    const docRef = useRef<Y.Doc | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);
    const yTextRef = useRef<Y.Text | null>(null);
    const cursorPresenceMapRef = useRef<Y.Map<unknown> | null>(null);
    const editorRef = useRef<MonacoEditor | null>(null);
    const snapshotSaveTimeoutRef = useRef<number | null>(null);
    const cursorListenerDisposeRef = useRef<{ dispose: () => void } | null>(null);

    const syncCursorPresenceState = useCallback(() => {
        const cursorMap = cursorPresenceMapRef.current;
        if (!cursorMap) {
            setCursorPresenceByUserId({});
            return;
        }

        const nextPresenceByUserId: Record<number, LobbyCursorPresence> = {};
        cursorMap.forEach((presenceValue, key) => {
            const userId = Number(key);
            if (!Number.isFinite(userId)) {
                return;
            }

            const presence = presenceValue as Partial<LobbyCursorPresence> | null;
            if (!presence || typeof presence !== "object") {
                return;
            }

            const line = Number(presence.line);
            const column = Number(presence.column);
            const selectionStartLine = Number(presence.selectionStartLine);
            const selectionStartColumn = Number(presence.selectionStartColumn);
            const selectionEndLine = Number(presence.selectionEndLine);
            const selectionEndColumn = Number(presence.selectionEndColumn);
            const updatedAt = Number(presence.updatedAt);

            if (
                !Number.isFinite(line) || line < 1
                || !Number.isFinite(column) || column < 1
                || !Number.isFinite(selectionStartLine) || selectionStartLine < 1
                || !Number.isFinite(selectionStartColumn) || selectionStartColumn < 1
                || !Number.isFinite(selectionEndLine) || selectionEndLine < 1
                || !Number.isFinite(selectionEndColumn) || selectionEndColumn < 1
            ) {
                return;
            }

            nextPresenceByUserId[userId] = {
                line: Math.floor(line),
                column: Math.floor(column),
                selectionStartLine: Math.floor(selectionStartLine),
                selectionStartColumn: Math.floor(selectionStartColumn),
                selectionEndLine: Math.floor(selectionEndLine),
                selectionEndColumn: Math.floor(selectionEndColumn),
                updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
            };
        });
        setCursorPresenceByUserId(nextPresenceByUserId);
    }, []);

    const setLocalCursorPresence = useCallback((presence: LobbyCursorPresence | null) => {
        const yDoc = docRef.current;
        const cursorMap = cursorPresenceMapRef.current;
        if (!yDoc || !cursorMap || currentUserId == null) {
            return;
        }

        const key = String(currentUserId);
        yDoc.transact(() => {
            if (presence == null) {
                cursorMap.delete(key);
            } else {
                cursorMap.set(key, presence);
            }
        }, "presence");
    }, [currentUserId]);

    const clearPendingSnapshotSave = useCallback(() => {
        if (snapshotSaveTimeoutRef.current != null) {
            window.clearTimeout(snapshotSaveTimeoutRef.current);
            snapshotSaveTimeoutRef.current = null;
        }
    }, []);

    const flushSnapshotSave = useCallback(async () => {
        if (lobbyId == null) {
            return;
        }

        const yDoc = docRef.current;
        if (!yDoc) {
            return;
        }

        clearPendingSnapshotSave();
        const plainText = yTextRef.current?.toString() ?? "";
        const snapshot = Uint8Array.from(Y.encodeStateAsUpdate(yDoc));
        await saveSnapshot(lobbyId, snapshot, plainText);
    }, [clearPendingSnapshotSave, lobbyId, saveSnapshot]);

    const scheduleSnapshotSave = useCallback(() => {
        if (snapshotDebounceMs <= 0) {
            return;
        }

        clearPendingSnapshotSave();
        snapshotSaveTimeoutRef.current = window.setTimeout(() => {
            void flushSnapshotSave();
        }, snapshotDebounceMs);
    }, [clearPendingSnapshotSave, flushSnapshotSave, snapshotDebounceMs]);

    const destroyBinding = useCallback(() => {
        if (bindingRef.current) {
            bindingRef.current.destroy();
            bindingRef.current = null;
        }
        if (cursorListenerDisposeRef.current) {
            cursorListenerDisposeRef.current.dispose();
            cursorListenerDisposeRef.current = null;
        }
        setEditorReady(false);
    }, []);

    const tryBindEditor = useCallback(() => {
        const editor = editorRef.current;
        const yText = yTextRef.current;
        if (!editor || !yText) {
            return;
        }

        const model = editor.getModel();
        if (!model) {
            return;
        }

        destroyBinding();
        bindingRef.current = new MonacoBinding(yText, model, new Set([editor]));
        if (currentUserId != null) {
            cursorListenerDisposeRef.current = editor.onDidChangeCursorSelection((event) => {
                const selection = event.selection;
                const position = selection?.getPosition();
                if (!position || !selection) {
                    setLocalCursorPresence(null);
                    return;
                }

                setLocalCursorPresence({
                    line: position.lineNumber,
                    column: position.column,
                    selectionStartLine: selection.startLineNumber,
                    selectionStartColumn: selection.startColumn,
                    selectionEndLine: selection.endLineNumber,
                    selectionEndColumn: selection.endColumn,
                    updatedAt: Date.now(),
                });
            });
            const lineCount = Math.max(1, model.getLineCount());
            const defaultLine = 1;
            const defaultColumn = Math.max(1, model.getLineMaxColumn(defaultLine));

            const currentPosition = editor.getPosition();
            const safeLine = currentPosition
                ? Math.max(1, Math.min(lineCount, currentPosition.lineNumber))
                : defaultLine;
            const safeColumn = currentPosition
                ? Math.max(1, Math.min(model.getLineMaxColumn(safeLine), currentPosition.column))
                : defaultColumn;

            const selection = editor.getSelection();
            const selectionStartLine = selection
                ? Math.max(1, Math.min(lineCount, selection.startLineNumber))
                : safeLine;
            const selectionEndLine = selection
                ? Math.max(1, Math.min(lineCount, selection.endLineNumber))
                : safeLine;
            const selectionStartColumn = selection
                ? Math.max(1, Math.min(model.getLineMaxColumn(selectionStartLine), selection.startColumn))
                : safeColumn;
            const selectionEndColumn = selection
                ? Math.max(1, Math.min(model.getLineMaxColumn(selectionEndLine), selection.endColumn))
                : safeColumn;

            setLocalCursorPresence({
                line: safeLine,
                column: safeColumn,
                selectionStartLine,
                selectionStartColumn,
                selectionEndLine,
                selectionEndColumn,
                updatedAt: Date.now(),
            });
        }
        setEditorReady(true);
    }, [currentUserId, destroyBinding, setLocalCursorPresence]);

    const disconnect = useCallback(() => {
        setLocalCursorPresence(null);
        void flushSnapshotSave();
        destroyBinding();
        clearPendingSnapshotSave();

        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }

        if (docRef.current) {
            docRef.current.destroy();
            docRef.current = null;
        }

        yTextRef.current = null;
        cursorPresenceMapRef.current = null;
        setCursorPresenceByUserId({});
        setLatestExecutionEvent(null);
        setConnectionState("idle");
    }, [clearPendingSnapshotSave, destroyBinding, flushSnapshotSave, setLocalCursorPresence]);

    const sendExecutionEvent = useCallback((event: LobbyExecutionEvent) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        socket.send(encodeExecutionEventMessage(event));
    }, []);

    const getCurrentSharedText = useCallback((): string => {
        return yTextRef.current?.toString() ?? "";
    }, []);

    const bindEditor = useCallback((monacoEditor: MonacoEditor, monacoLib: unknown) => {
        void monacoLib;
        editorRef.current = monacoEditor;
        tryBindEditor();
    }, [tryBindEditor]);

    useEffect(() => {
        let cancelled = false;
        let receivedSyncReply = false;
        let seedInitialTextTimeout: number | null = null;
        disconnect();

        const connect = async () => {
            if (lobbyId == null) {
                setConnectionState("idle");
                return;
            }

            const token = getAccessToken();
            if (!token) {
                setConnectionState("error");
                return;
            }

            setConnectionState("connecting");

            const yDoc = new Y.Doc();
            docRef.current = yDoc;
            yTextRef.current = yDoc.getText("monaco");
            cursorPresenceMapRef.current = yDoc.getMap<unknown>("presence");
            const onCursorPresenceChanged = () => {
                syncCursorPresenceState();
            };
            cursorPresenceMapRef.current.observe(onCursorPresenceChanged);
            syncCursorPresenceState();

            try {
                const snapshot = await loadSnapshot(lobbyId);
                if (!cancelled && snapshot && snapshot.length > 0) {
                    Y.applyUpdate(yDoc, snapshot, "remote");
                }
            } catch {
                // Snapshot load failures should not block live collaboration startup.
            }

            if (cancelled) {
                cursorPresenceMapRef.current?.unobserve(onCursorPresenceChanged);
                yDoc.destroy();
                return;
            }

            const wsUrl = `${resolveWsBaseUrl()}/ws/lobbies/${lobbyId}?token=${encodeURIComponent(token)}`;
            const socket = new WebSocket(wsUrl);
            socket.binaryType = "arraybuffer";
            socketRef.current = socket;

            socket.onopen = () => {
                const stateVector = Y.encodeStateVector(yDoc);
                socket.send(encodeFramedMessage(MSG_SYNC_REQUEST, stateVector));

                if (
                    allowInitialPlainTextSeed
                    && initialPlainText != null
                    && initialPlainText.length > 0
                    && initialPlainTextSeedDelayMs >= 0
                ) {
                    seedInitialTextTimeout = window.setTimeout(() => {
                        if (cancelled || receivedSyncReply) {
                            return;
                        }

                        const yText = yTextRef.current;
                        if (!yText || yText.length > 0) {
                            return;
                        }

                        yDoc.transact(() => {
                            yText.insert(0, initialPlainText);
                        }, "initial-seed");
                    }, initialPlainTextSeedDelayMs);
                }

                setConnectionState("connected");
            };
            socket.onerror = () => {
                setConnectionState("error");
            };
            socket.onclose = () => {
                setConnectionState("disconnected");
            };
            socket.onmessage = (event) => {
                const handleMessage = async () => {
                    let messageBytes: Uint8Array | null = null;

                    if (event.data instanceof ArrayBuffer) {
                        messageBytes = new Uint8Array(event.data);
                    } else if (event.data instanceof Blob) {
                        const buffer = await event.data.arrayBuffer();
                        messageBytes = new Uint8Array(buffer);
                    }

                    if (cancelled || !messageBytes || messageBytes.length === 0) {
                        return;
                    }

                    const messageType = messageBytes[0];
                    const payload = messageBytes.subarray(1);

                    if (messageType === MSG_UPDATE || messageType === MSG_SYNC_REPLY) {
                        if (messageType === MSG_SYNC_REPLY) {
                            receivedSyncReply = true;
                        }
                        if (payload.length > 0) {
                            Y.applyUpdate(yDoc, payload, "remote");
                        }
                        return;
                    }

                    if (messageType === MSG_EXECUTION_EVENT) {
                        const eventPayload = parseExecutionEvent(payload);
                        if (eventPayload) {
                            setLatestExecutionEvent(eventPayload);
                        }
                        return;
                    }

                    if (messageType === MSG_SYNC_REQUEST) {
                        if (socket.readyState !== WebSocket.OPEN) {
                            return;
                        }
                        const missingHistory = Y.encodeStateAsUpdate(yDoc, payload);
                        socket.send(encodeFramedMessage(MSG_SYNC_REPLY, missingHistory));
                    }
                };

                void handleMessage();
            };

            const onDocumentUpdate = (update: Uint8Array, origin: unknown) => {
                if (
                    origin !== "remote"
                    && socket.readyState === WebSocket.OPEN
                ) {
                    socket.send(encodeFramedMessage(MSG_UPDATE, update));
                }

                if (origin !== "presence") {
                    scheduleSnapshotSave();
                }
            };

            yDoc.on("update", onDocumentUpdate);
            tryBindEditor();

            if (cancelled) {
                if (seedInitialTextTimeout != null) {
                    window.clearTimeout(seedInitialTextTimeout);
                    seedInitialTextTimeout = null;
                }
                cursorPresenceMapRef.current?.unobserve(onCursorPresenceChanged);
                yDoc.off("update", onDocumentUpdate);
                socket.close();
                yDoc.destroy();
            }
        };

        void connect();

        return () => {
            cancelled = true;
            if (seedInitialTextTimeout != null) {
                window.clearTimeout(seedInitialTextTimeout);
                seedInitialTextTimeout = null;
            }
            disconnect();
        };
    }, [
        allowInitialPlainTextSeed,
        disconnect,
        initialPlainText,
        initialPlainTextSeedDelayMs,
        loadSnapshot,
        lobbyId,
        scheduleSnapshotSave,
        syncCursorPresenceState,
        tryBindEditor,
    ]);

    useEffect(() => {
        const saveOnUnload = () => {
            void flushSnapshotSave();
        };

        window.addEventListener("beforeunload", saveOnUnload);
        window.addEventListener("pagehide", saveOnUnload);
        return () => {
            window.removeEventListener("beforeunload", saveOnUnload);
            window.removeEventListener("pagehide", saveOnUnload);
        };
    }, [flushSnapshotSave]);

    return {
        editorReady,
        connectionState,
        cursorPresenceByUserId,
        latestExecutionEvent,
        bindEditor,
        sendExecutionEvent,
        getCurrentSharedText,
        disconnect,
    };
}
