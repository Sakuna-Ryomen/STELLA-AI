/* =========================================================
   LIVEKIT STELLA VOICE HOOK
   Connects React to the Python LiveKit Agent (Gemini Realtime)
========================================================= */

import { useRef, useState, useCallback, useEffect } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

export function useLiveKitStella({ onMessage, onStateChange, isMicMuted = false }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [agentPresent, setAgentPresent] = useState(false);
  const [error, setError] = useState(null);

  const roomRef = useRef(null);
  const audioElementsRef = useRef([]);

  // Cleanup helper to destroy all remote audio DOM elements
  const cleanupAudioElements = useCallback(() => {
    audioElementsRef.current.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {}
    });
    audioElementsRef.current = [];
  }, []);

  // Cleanup helper to stop hardware microphone streams
  const cleanupMicrophoneTracks = useCallback(() => {
    if (roomRef.current?.localParticipant) {
      try {
        for (const pub of roomRef.current.localParticipant.trackPublications.values()) {
          if (pub.track) {
            try {
              pub.track.stop();
            } catch {}
          }
        }
      } catch (err) {
        console.warn("[Stella] Track stop warning:", err);
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      cleanupMicrophoneTracks();
      cleanupAudioElements();

      // Cleanly stop the Python agent process tree in Electron
      if (window.electronAPI?.stopPythonAgent) {
        window.electronAPI.stopPythonAgent().catch(() => {});
      }

      if (roomRef.current) {
        await roomRef.current.disconnect(true);
        roomRef.current = null;
      }
    } catch (err) {
      console.warn("[Stella] Disconnect warning:", err);
    } finally {
      roomRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
      setAgentPresent(false);
      onStateChange?.("idle");
    }
  }, [cleanupMicrophoneTracks, cleanupAudioElements, onStateChange]);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);
    onStateChange?.("thinking");

    // Clean up any lingering tracks or audio directly without state regression
    cleanupMicrophoneTracks();
    cleanupAudioElements();
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect(true);
      } catch {}
      roomRef.current = null;
    }

    try {
      // 0. Auto-trigger fresh Python agent in Electron if running inside desktop app
      if (window.electronAPI?.startPythonAgent) {
        window.electronAPI.startPythonAgent().catch(() => {});
      }

      // 1. Fetch LiveKit Token
      let tokenData = null;
      if (window.electronAPI?.getLiveKitToken) {
        try {
          tokenData = await window.electronAPI.getLiveKitToken();
        } catch {
          tokenData = null;
        }
      }

      if (!tokenData) {
        const res = await fetch("/api/livekit-token");
        if (!res.ok) {
          throw new Error(`Token request failed with status: ${res.status}`);
        }
        tokenData = await res.json();
      }

      const { serverUrl, token } = tokenData;
      if (!serverUrl || !token) {
        throw new Error("Invalid LiveKit credentials received");
      }

      // 2. Create Fresh LiveKit Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      roomRef.current = room;

      // 3. Handle incoming agent voice audio
      const attachAudioTrack = (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          el.volume = 1.0;
          document.body.appendChild(el);
          audioElementsRef.current.push(el);

          el.play().catch((e) => console.warn("[Stella] Audio play warning:", e));
        }
      };

      room.on(RoomEvent.TrackSubscribed, (track) => {
        attachAudioTrack(track);
      });

      // 4. Handle Participant Connection & Presence
      const checkAgentPresence = () => {
        const remoteCount = room.remoteParticipants.size;
        setAgentPresent(remoteCount > 0);
      };

      room.on(RoomEvent.ParticipantConnected, (p) => {
        checkAgentPresence();
        onMessage?.({
          id: `p-join-${Date.now()}`,
          role: "stella",
          text: "Stella neural agent linked. Initializing Gemini voice...",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        checkAgentPresence();
      });

      // 5. Handle Voice Activity (Speaking vs Listening vs Thinking)
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentSpeaker = speakers.find((s) => s.identity !== room.localParticipant?.identity);
        const localSpeaker = speakers.find((s) => s.identity === room.localParticipant?.identity);

        if (agentSpeaker) {
          onStateChange?.("speaking");
        } else if (localSpeaker) {
          onStateChange?.("listening");
        } else {
          onStateChange?.("idle");
        }
      });

      // 6. Handle Live Transcriptions (streaming interim + final speech)
      room.on(RoomEvent.TranscriptionReceived, (transcriptions, participant) => {
        for (const t of transcriptions) {
          if (!t.text || !t.text.trim()) continue;

          const isLocal = participant?.identity === room.localParticipant?.identity;
          const role = isLocal ? "user" : "stella";

          // Use segment's exact start time (when speech began), falling back to firstReceivedTime or current time
          const timestamp = t.startTime ? Math.floor(t.startTime) : (t.firstReceivedTime ? Math.floor(t.firstReceivedTime) : Date.now());

          onMessage?.({
            id: t.id ? `seg-${t.id}` : `trans-${role}-${timestamp}`,
            segmentId: t.id || `${role}-${timestamp}`,
            role,
            text: t.text.trim(),
            time: new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            timestamp,
            final: Boolean(t.final),
          });
        }
      });

      // 7. Handle Text/Data packets from Agent
      room.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const str = new TextDecoder().decode(payload);
          const data = JSON.parse(str);
          if (data.type === "state" && data.state) {
            onStateChange?.(data.state);
          } else if (data.text) {
            const isLocal = participant?.identity === room.localParticipant?.identity;
            const now = Date.now();
            onMessage?.({
              id: data.id || `msg-${now}-${Math.random().toString(36).substring(2, 6)}`,
              role: data.role || (isLocal ? "user" : "stella"),
              text: data.text,
              time: data.time || new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              timestamp: data.timestamp || now,
            });
          }
        } catch {
          // ignore non-json packet
        }
      });

      // 8. Handle Disconnection
      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        setAgentPresent(false);
        onStateChange?.("idle");
      });

      // 9. Connect to Room
      await room.connect(serverUrl, token);

      // 10. UNBLOCK AUDIO PLAYBACK (Crucial for hearing Gemini's voice)
      try {
        await room.startAudio();
      } catch (audioErr) {
        console.warn("[Stella] startAudio warning:", audioErr);
      }

      // Check if agent is already in the room
      checkAgentPresence();
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.track) attachAudioTrack(pub.track);
        });
      });

      // 11. Publish Local Microphone Track (Clean fresh stream)
      try {
        await room.localParticipant.setMicrophoneEnabled(!isMicMuted, {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        console.log("[Stella] Mic published. Enabled state:", room.localParticipant.isMicrophoneEnabled);
      } catch (micErr) {
        console.warn("[Stella] Microphone publish error:", micErr);
      }

      setIsConnected(true);
      setIsConnecting(false);
      onStateChange?.("idle");

      onMessage?.({
        id: `lk-conn-${Date.now()}`,
        role: "stella",
        text: "Connected to room 'stella-room'. Speak into your microphone.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      console.error("[Stella] LiveKit connection error:", err);
      setError(err.message);
      setIsConnecting(false);
      setIsConnected(false);
      onStateChange?.("disconnected");

      onMessage?.({
        id: `lk-err-${Date.now()}`,
        role: "stella",
        text: `Connection failed: ${err.message}.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }
  }, [isConnecting, isConnected, disconnect, isMicMuted, onMessage, onStateChange]);

  const setMuted = useCallback(async (muted) => {
    if (roomRef.current?.localParticipant) {
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(!muted);
      } catch (err) {
        console.warn("[Stella] Mute toggle error:", err);
      }
    }
  }, []);

  const sendTextMessage = useCallback(async (text) => {
    if (roomRef.current?.localParticipant) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ text, type: "user_chat", timestamp: Date.now() }));
        await roomRef.current.localParticipant.publishData(payload, { reliable: true });
      } catch (err) {
        console.warn("[Stella] Data publish error:", err);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMicrophoneTracks();
      cleanupAudioElements();
      if (roomRef.current) {
        roomRef.current.disconnect(true).catch(() => {});
        roomRef.current = null;
      }
    };
  }, [cleanupMicrophoneTracks, cleanupAudioElements]);

  return {
    isConnected,
    isConnecting,
    agentPresent,
    error,
    connect,
    disconnect,
    setMuted,
    sendTextMessage,
  };
}
