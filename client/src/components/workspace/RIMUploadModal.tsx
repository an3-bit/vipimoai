import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  djangoCreateRIM,
  djangoUploadRIM,
  djangoIngestVision,
  taskWebSocketUrl,
} from "@/lib/apiClient";
import { getAccessToken } from "@/lib/apiClient";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RIMUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  center?: { lat: number; lng: number } | null;
}

export function RIMUploadModal({
  open,
  onOpenChange,
  projectId,
  center = null,
}: RIMUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [polygonText, setPolygonText] = useState("");
  const [polygonCoords, setPolygonCoords] = useState<
    { lat: number; lng: number }[]
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!taskId) return;
    const url = taskWebSocketUrl(taskId);
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () =>
        setMessages((m) => [...m, { type: "system", text: "ws_open" }]);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setMessages((m) => [...m, data]);
        } catch (e) {
          setMessages((m) => [...m, { raw: ev.data }]);
        }
      };
      ws.onclose = () =>
        setMessages((m) => [...m, { type: "system", text: "ws_closed" }]);
    } catch (e) {
      console.warn("ws connect failed", e);
      setMessages((m) => [...m, { type: "error", text: "ws_connect_failed" }]);
    }

    return () => {
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, [taskId]);

  useEffect(() => {
    // Keep polygonText in sync with drawn coords
    if (polygonCoords && polygonCoords.length > 0) {
      setPolygonText(JSON.stringify(polygonCoords));
    }
  }, [polygonCoords]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
  };

  function MapDraw() {
    // default center (Nairobi) — small embedded map for quick polygon drawing
    const center: [number, number] = [-1.286389, 36.817223];

    useMapEvents({
      click(e) {
        setPolygonCoords((p) => [
          ...p,
          { lat: e.latlng.lat, lng: e.latlng.lng },
        ]);
      },
    });

    return (
      <>
        {polygonCoords.length > 0 && (
          <Polygon
            positions={polygonCoords.map((c) => [c.lat, c.lng]) as any}
            pathOptions={{ color: "orange" }}
          />
        )}
        {polygonCoords.map((c, i) => (
          <Marker key={i} position={[c.lat, c.lng]} interactive={false} />
        ))}
      </>
    );
  }

  const handleStart = async () => {
    if (!file) return toast.error("Select an image first");
    setIsUploading(true);
    setUploadProgress(null);

    try {
      // 1) Create RIM metadata
      const createResp: any = await djangoCreateRIM({
        name: file.name,
        project_id: projectId,
      });
      const rimId = createResp.id;

      // 2) Upload file with progress (XHR)
      await new Promise<void>((resolve, reject) => {
        const token = getAccessToken();
        const xhr = new XMLHttpRequest();
        const url = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"}/rims/${rimId}/upload/`;
        xhr.open("POST", url, true);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 100);
            setUploadProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));

        const form = new FormData();
        form.append("file", file);
        try {
          // include tie_points if polygon coords present
          if (polygonCoords && polygonCoords.length > 0) {
            form.append("tie_points", JSON.stringify(polygonCoords));
          }
        } catch {
          // ignore
        }

        xhr.send(form);
      });

      toast.success("Upload saved");

      toast.success("Upload saved");

      // 3) Optionally parse polygon
      let polygon = null;
      if (polygonText.trim()) {
        try {
          polygon = JSON.parse(polygonText);
        } catch (e) {
          /* ignore */
        }
      }

      // 4) Trigger ingest
      const ingestResp: any = await djangoIngestVision({
        rim_id: rimId,
        polygon,
        crs: "EPSG:21037",
      });
      setTaskId(ingestResp.task_id);
      toast.success("Ingest started");
    } catch (err: any) {
      console.error(err);
      toast.error(String(err.message || err));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl glass-panel p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Upload RIM Photo</DialogTitle>
          <DialogDescription>
            Upload a high-res RIM image and trigger the vision pipeline.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Image File
              </label>
              <input type="file" accept="image/*" onChange={handleFileChange} />
              {file && (
                <div className="mt-2 text-sm">
                  Selected: {file.name} ({(file.size / 1024) | 0} KB)
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Draw Geo Polygon (click on map)
              </label>
              <div className="h-56 rounded overflow-hidden border">
                <MapContainer
                  center={
                    center ? [center.lat, center.lng] : [-1.286389, 36.817223]
                  }
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapDraw />
                </MapContainer>
              </div>

              <div className="mt-2 flex gap-2">
                <Button onClick={() => setPolygonCoords([])} variant="ghost">
                  Clear Polygon
                </Button>
                <Button
                  onClick={() => {
                    // Export polygon JSON to textarea for manual edits
                    setPolygonText(JSON.stringify(polygonCoords));
                  }}
                  variant="outline"
                >
                  Export JSON
                </Button>
              </div>
              <label className="block text-sm font-medium mb-1 mt-2">
                Polygon JSON (editable)
              </label>
              <Textarea
                value={polygonText}
                onChange={(e) => setPolygonText(e.target.value)}
                placeholder='[ { "lat": -1.29, "lng": 36.82 }, ... ]'
              />
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleStart} disabled={isUploading}>
                {isUploading ? "Uploading..." : "Upload & Start Ingest"}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
            {uploadProgress !== null && (
              <div className="mt-3">
                <div className="text-sm mb-1">
                  Upload progress: {uploadProgress}%
                </div>
                <div className="w-full bg-gray-200 h-2 rounded">
                  <div
                    style={{ width: `${uploadProgress}%` }}
                    className="h-2 bg-primary rounded"
                  />
                </div>
              </div>
            )}

            {taskId && (
              <div>
                <h4 className="font-semibold">Task</h4>
                <div>Task ID: {taskId}</div>
                <div className="mt-2">
                  <h5 className="font-medium">Messages</h5>
                  <div className="mt-2 max-h-40 overflow-auto bg-muted p-2 rounded">
                    {messages.map((m, i) => (
                      <pre key={i} className="text-xs">
                        {JSON.stringify(m)}
                      </pre>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
