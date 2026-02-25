/*
 * Sony Cyber-shot Style Photobooth
 * Design: Retro digital camera aesthetic inspired by Sony Cyber-shot
 * Features: Full-screen camera, front/back toggle, strip design selection
 */

import { Camera, Download, RotateCcw, RefreshCw, Share2, Printer } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

type LayoutType = "single" | "strip" | null;
type FacingMode = "user" | "environment";
type CameraFilter = "original" | "retro";
type DesignType = "plain" | "designed";

interface CapturedPhoto {
  dataUrl: string;
  timestamp: Date;
}

// Strip overlay: transparent PNG (600x1870) with stickers positioned in gaps
const BASE = import.meta.env.BASE_URL;
const STRIP_OVERLAY = `${BASE}images/Strip_Overlay_v2.png`;

// Frame1_hires.png: 2752x1536 — 1 photo slot for single landscape layout
// Scaled to 600px wide canvas (scale = 600/2752 = 0.2180)
const FRAME_CANVAS_W = 600;
const FRAME_CANVAS_H = 335; // int(1536 * 600/2752)
const FRAME_OVERLAY = `${BASE}images/Frame1_hires.png`;
// Photo area: x=354-2397, y=300-1100 in original → scaled
const FRAME_SLOT = { x: 77, y: 65, w: 445, h: 175 };

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filmStripCanvasRef = useRef<HTMLCanvasElement>(null);

  const [step, setStep] = useState<"layout" | "camera" | "design" | "final">("layout");
  const [layout, setLayout] = useState<LayoutType>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [cameraError, setCameraError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [filmStripDataUrl, setFilmStripDataUrl] = useState("");
  const [filmStripReady, setFilmStripReady] = useState(false);
  const [eventText, setEventText] = useState("");
  const [cameraFilter, setCameraFilter] = useState<CameraFilter>("original");
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedDesign, setSelectedDesign] = useState<DesignType>("plain");

  // ─── Camera ───────────────────────────────────────────────────────────────

  const startCamera = useCallback(async (mode?: FacingMode) => {
    setCameraError("");
    const facing = mode ?? facingMode;
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (error) {
      console.error("Camera error:", error);
      setCameraError("Unable to access camera. Please check permissions.");
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    setStream((prev) => {
      if (prev) {
        prev.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const newMode: FacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    // Stop current stream then start with new facing mode
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    startCamera(newMode);
  }, [facingMode, stream, startCamera]);

  // Attach stream to video element whenever stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Start camera when entering camera step
  useEffect(() => {
    if (step === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Filters ──────────────────────────────────────────────────────────────

  const applyRetroFilter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = "rgba(255, 200, 100, 0.08)";
    ctx.fillRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height));
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 2;
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.1})`;
      ctx.fillRect(x, y, size, size);
    }
  };

  // ─── Capture ──────────────────────────────────────────────────────────────

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = videoRef.current.videoWidth || 640;
    const vh = videoRef.current.videoHeight || 480;
    canvas.width = vw;
    canvas.height = vh;

    // Mirror horizontally for front camera
    if (facingMode === "user") {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, -vw, 0, vw, vh);
      ctx.restore();
    } else {
      ctx.drawImage(videoRef.current, 0, 0, vw, vh);
    }

    if (cameraFilter === "retro") {
      applyRetroFilter(ctx, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL("image/png");
    setPhotos((prev) => [...prev, { dataUrl, timestamp: new Date() }]);
  }, [cameraFilter, facingMode]);

  // Auto-capture sequence for strip mode
  useEffect(() => {
    if (!isAutoCapturing || !layout) return;

    const photoCount = layout === "strip" ? 4 : 1;

    const captureSequence = async () => {
      for (let i = 0; i < photoCount; i++) {
        setCurrentPhotoIndex(i);
        for (let j = 3; j > 0; j--) {
          setCountdown(j);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        setCountdown(null);
        await capturePhoto();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      setIsAutoCapturing(false);
      setCurrentPhotoIndex(0);
      setStep("design");
    };

    captureSequence();
  }, [isAutoCapturing, layout, capturePhoto]);

  // ─── Film Strip Generation ─────────────────────────────────────────────────

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = src;
    });

  const generateFilmStrip = useCallback(async () => {
    if (photos.length === 0 || !filmStripCanvasRef.current) return;
    setFilmStripReady(false);

    const canvas = filmStripCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isSingle = layout === "single";

    if (selectedDesign === "designed") {
      if (isSingle) {
        // ── Single with Frame1.png overlay ──────────────────────────────
        canvas.width = FRAME_CANVAS_W;
        canvas.height = FRAME_CANVAS_H;

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, FRAME_CANVAS_W, FRAME_CANVAS_H);

        // Draw photo in the frame slot
        const photo = photos[0];
        const img = await loadImage(photo.dataUrl);
        const { x, y, w, h } = FRAME_SLOT;
        // Cover-fit the photo into the slot
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const slotAspect = w / h;
        let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        if (imgAspect > slotAspect) {
          sw = img.naturalHeight * slotAspect;
          sx = (img.naturalWidth - sw) / 2;
        } else {
          sh = img.naturalWidth / slotAspect;
          sy = (img.naturalHeight - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);

        // Draw Frame overlay on top
        const overlay = await loadImage(FRAME_OVERLAY);
        ctx.drawImage(overlay, 0, 0, FRAME_CANVAS_W, FRAME_CANVAS_H);
      } else {
        // ── Strip with sticker overlay (same dimensions as plain strip) ──
        const stripWidth = 600;
        const photoWidth = 560;
        const photoHeight = 400;
        const margin = 20;
        const headerHeight = 100;
        const footerHeight = 100;
        const spacing = 10;
        const photoSectionHeight = photos.length * (photoHeight + spacing) - spacing;
        const totalHeight = headerHeight + photoSectionHeight + footerHeight + margin * 2;

        canvas.width = stripWidth;
        canvas.height = totalHeight;

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, stripWidth, totalHeight);

        // Draw photos (same positions as plain strip)
        let currentY = margin + headerHeight;
        for (let i = 0; i < photos.length; i++) {
          const img = await loadImage(photos[i].dataUrl);
          const photoX = margin;
          // Cover-fit
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const slotAspect = photoWidth / photoHeight;
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
          if (imgAspect > slotAspect) {
            sw = img.naturalHeight * slotAspect;
            sx = (img.naturalWidth - sw) / 2;
          } else {
            sh = img.naturalWidth / slotAspect;
            sy = (img.naturalHeight - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, photoX, currentY, photoWidth, photoHeight);
          currentY += photoHeight + spacing;
        }

        // Draw sticker overlay on top (transparent PNG, same canvas size)
        const overlay = await loadImage(STRIP_OVERLAY);
        ctx.drawImage(overlay, 0, 0, stripWidth, totalHeight);
      }
    } else {
      // ── Plain design (original layout) ────────────────────────────────
      const stripWidth = 600;
      const photoWidth = 560;
      const photoHeight = isSingle ? 560 : 400;
      const margin = 20;
      const headerHeight = 100;
      const footerHeight = 100;
      const spacing = 10;

      const photoSectionHeight = isSingle
        ? photoHeight
        : photos.length * (photoHeight + spacing) - spacing;
      const totalHeight = headerHeight + photoSectionHeight + footerHeight + margin * 2;

      canvas.width = stripWidth;
      canvas.height = totalHeight;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, stripWidth, totalHeight);

      // Subtle grain
      ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
      for (let i = 0; i < 1500; i++) {
        ctx.fillRect(Math.random() * stripWidth, Math.random() * totalHeight, 1, 1);
      }

      let currentY = margin + headerHeight;

      // Header
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(margin, margin, photoWidth, headerHeight - 10);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px 'Share Tech Mono', monospace";
      ctx.fillText("REC ● PLAY ▲ SP   CYBER-SHOT", margin + 15, margin + 30);

      const eventDate = photos[0].timestamp;
      const monthYear = eventDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
      ctx.fillStyle = "#ff9900";
      ctx.font = "bold 22px 'Orbitron', sans-serif";
      ctx.fillText(`${monthYear} — ${eventText.toUpperCase() || "MEMORIES"}`, margin + 15, margin + headerHeight - 25);

      // Photos
      for (let i = 0; i < photos.length; i++) {
        const img = await loadImage(photos[i].dataUrl);
        const photoX = margin + (photoWidth - 560) / 2;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(photoX - 5, currentY - 5, 560 + 10, photoHeight + 10);

        // Cover-fit
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const slotAspect = 560 / photoHeight;
        let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        if (imgAspect > slotAspect) {
          sw = img.naturalHeight * slotAspect;
          sx = (img.naturalWidth - sw) / 2;
        } else {
          sh = img.naturalWidth / slotAspect;
          sy = (img.naturalHeight - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, photoX, currentY, 560, photoHeight);
        currentY += photoHeight + spacing;
      }

      // Footer
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(margin, currentY, photoWidth, footerHeight - 10);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px 'Share Tech Mono', monospace";
      ctx.fillText("CYBER-SHOT BOOTH", margin + 15, currentY + 30);
      ctx.fillStyle = "#ff9900";
      ctx.font = "bold 18px 'Orbitron', sans-serif";
      ctx.fillText("MEMORIES MADE", margin + 15, currentY + 65);
      ctx.fillStyle = "#666666";
      const dateStr = eventDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
      const dateWidth = ctx.measureText(dateStr).width;
      ctx.fillText(dateStr, (stripWidth - dateWidth) / 2, currentY + 80);
    }

    setFilmStripDataUrl(canvas.toDataURL("image/png"));
    setFilmStripReady(true);
  }, [photos, layout, eventText, selectedDesign]);

  // ─── Download / Share ─────────────────────────────────────────────────────

  const isNative = Capacitor.isNativePlatform();

  const downloadFilmStrip = async () => {
    if (!filmStripDataUrl) return;
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `cybershot-${timestamp}.png`;

    if (isNative) {
      try {
        const base64Data = filmStripDataUrl.split(",")[1];
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
        });
        alert("Photo saved!");
        console.log("Saved to:", result.uri);
      } catch (error) {
        console.error("Error saving photo:", error);
        alert("Failed to save photo. Please try again.");
      }
    } else {
      try {
        const blob = await (await fetch(filmStripDataUrl)).blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {
        const link = document.createElement("a");
        link.href = filmStripDataUrl;
        link.download = fileName;
        link.click();
      }
    }
  };

  const printFilmStrip = () => {
    if (!filmStripDataUrl) return;
    const printWindow = window.open("", "", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(
        `<html><head><title>Cyber-shot Booth Photo</title><style>body{margin:0;padding:20px;background:white;}img{max-width:100%;height:auto;display:block;margin:0 auto;}@media print{body{padding:0;}}</style></head><body><img src="${filmStripDataUrl}" /></body></html>`
      );
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  const sharePhoto = async () => {
    if (!filmStripDataUrl || !isNative) return;
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `cybershot-${timestamp}.png`;
      const base64Data = filmStripDataUrl.split(",")[1];
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });
      await Share.share({
        title: "Cyber-shot Photo",
        text: "Check out my photo from Cyber-shot Booth!",
        url: result.uri,
        dialogTitle: "Share your photo",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  // ─── Navigation ───────────────────────────────────────────────────────────

  const reset = () => {
    setLayout(null);
    setPhotos([]);
    setEventText("");
    setFilmStripReady(false);
    setFilmStripDataUrl("");
    setStep("layout");
    setCameraError("");
    setCameraFilter("original");
    setIsAutoCapturing(false);
    setCurrentPhotoIndex(0);
    setCountdown(null);
    setSelectedDesign("plain");
  };

  const selectLayout = (type: LayoutType) => {
    setLayout(type);
    setPhotos([]);
    setStep("camera");
  };

  const moveToFinal = () => {
    setStep("final");
    generateFilmStrip();
  };

  // When design selection changes, regenerate preview
  useEffect(() => {
    if (step === "design" && photos.length > 0) {
      generateFilmStrip();
    }
  }, [selectedDesign, step, photos, generateFilmStrip]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-screen bg-gradient-to-b from-[#b0b0b0] to-[#909090] flex items-center justify-center p-2">

      {/* ── Step 1: Layout Selection ── */}
      {step === "layout" && (
        <div className="camera-body rounded-xl p-4 w-full max-w-md flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm text-gray-600">Cyber-shot</span>
            <div className="w-4 h-4 rounded-full bg-red-500" />
          </div>

          <div className="lcd-screen rounded-lg p-6 text-center">
            <h1 className="font-display text-3xl lcd-text mb-4">PHOTOBOOTH</h1>
            <p className="font-lcd text-lg lcd-text mb-8">SELECT MODE</p>

            <div className="flex gap-4">
              <button
                onClick={() => selectLayout("single")}
                className="flex-1 bg-white border-4 border-gray-300 rounded-lg p-4 hover:bg-gray-100 transition"
              >
                <Camera className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                <p className="font-display text-sm">1 PHOTO</p>
              </button>

              <button
                onClick={() => selectLayout("strip")}
                className="flex-1 bg-white border-4 border-gray-300 rounded-lg p-4 hover:bg-gray-100 transition"
              >
                <div className="flex flex-col gap-1 mx-auto mb-2 w-8">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="w-8 h-2 bg-gray-400 rounded" />
                  ))}
                </div>
                <p className="font-display text-sm">4 PHOTOS</p>
              </button>
            </div>
          </div>

          <div className="text-center">
            <p className="font-lcd text-xs lcd-text">SONY</p>
          </div>
        </div>
      )}

      {/* ── Step 2: Camera ── */}
      {step === "camera" && (
        <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2">
          <div className="camera-body rounded-xl p-4 flex-1 flex flex-col h-[80dvh]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-sm text-gray-600">Cyber-shot</span>
              <span className="font-lcd text-sm lcd-text bg-black/80 px-2 py-1 rounded">REC</span>
            </div>

            {/* Camera View */}
            <div className="lcd-screen rounded-lg flex-1 overflow-hidden mb-3 flex items-center justify-center bg-black relative">
              {cameraError && (
                <div className="text-center text-white">
                  <p className="mb-4">{cameraError}</p>
                  <button
                    onClick={() => startCamera()}
                    className="shutter-btn px-4 py-2 rounded text-white text-sm"
                  >
                    RETRY
                  </button>
                </div>
              )}

              {!stream && !cameraError && (
                <div className="text-center text-orange-500">
                  <p className="font-lcd text-lg mb-2">STARTING CAMERA...</p>
                </div>
              )}

              {/* Countdown overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <span className="font-display text-8xl text-white drop-shadow-lg">{countdown}</span>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!stream ? "hidden" : ""} ${cameraFilter === "retro" ? "brightness-110 contrast-125 saturate-150" : ""}`}
              />
            </div>

            {/* Controls */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={toggleCamera}
                  disabled={!stream || isAutoCapturing}
                  className="camera-btn flex-1 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  FLIP
                </button>

                <button
                  onClick={() => setCameraFilter(cameraFilter === "original" ? "retro" : "original")}
                  disabled={isAutoCapturing}
                  className={`flex-1 py-2 rounded-lg font-display text-white text-sm disabled:opacity-50 ${
                    cameraFilter === "retro" ? "shutter-btn" : "camera-btn"
                  }`}
                >
                  {cameraFilter === "retro" ? "RETRO" : "ORIGINAL"}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (layout === "strip") {
                      setIsAutoCapturing(true);
                    } else {
                      capturePhoto().then(() => setTimeout(() => setStep("design"), 500));
                    }
                  }}
                  disabled={!stream || isAutoCapturing}
                  className="shutter-btn flex-1 py-3 rounded-lg font-display text-white text-sm disabled:opacity-50"
                >
                  {isAutoCapturing
                    ? `PHOTO ${currentPhotoIndex + 1} / 4`
                    : countdown !== null
                    ? `${countdown}`
                    : layout === "strip"
                    ? "START SEQUENCE"
                    : "CAPTURE"}
                </button>
              </div>

              <input
                type="text"
                placeholder="Event name (optional)"
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm bg-white/80"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Design Selection ── */}
      {step === "design" && (
        <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2 overflow-auto">
          <div className="camera-body rounded-xl p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-sm text-gray-600">Cyber-shot</span>
              <span className="font-lcd text-sm lcd-text bg-black/80 px-2 py-1 rounded">DESIGN</span>
            </div>

            {/* Preview */}
            <div className="lcd-screen rounded-lg flex-1 overflow-auto mb-3 flex items-center justify-center bg-black p-2">
              {filmStripReady ? (
                <img src={filmStripDataUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded" />
              ) : (
                <div className="text-center">
                  <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="font-lcd text-lg lcd-text">LOADING...</p>
                </div>
              )}
            </div>

            {/* Design options */}
            <div className="flex gap-3 mb-3">
              {/* Plain option */}
              <button
                onClick={() => setSelectedDesign("plain")}
                className={`flex-1 rounded-lg p-3 border-4 transition flex flex-col items-center gap-2 ${
                  selectedDesign === "plain"
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="w-full h-16 bg-gray-100 border-2 border-gray-300 rounded flex items-center justify-center">
                  <div className="flex flex-col gap-1 w-8">
                    {layout === "strip"
                      ? [0, 1, 2, 3].map((i) => <div key={i} className="w-8 h-1.5 bg-gray-400 rounded" />)
                      : <div className="w-8 h-8 bg-gray-400 rounded" />}
                  </div>
                </div>
                <span className="font-display text-xs">PLAIN</span>
              </button>

              {/* Designed option */}
              <button
                onClick={() => setSelectedDesign("designed")}
                className={`flex-1 rounded-lg p-3 border-4 transition flex flex-col items-center gap-2 ${
                  selectedDesign === "designed"
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="w-full h-16 rounded overflow-hidden border-2 border-gray-300">
                  <img
                    src={layout === "strip" ? STRIP_OVERLAY : FRAME_OVERLAY}
                    alt="Design preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-display text-xs">DESIGNED</span>
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPhotos([]);
                  setFilmStripReady(false);
                  setFilmStripDataUrl("");
                  setStep("camera");
                }}
                className="camera-btn flex-1 py-2 rounded-lg text-sm"
              >
                RETAKE
              </button>
              <button
                onClick={moveToFinal}
                disabled={!filmStripReady}
                className="shutter-btn flex-1 py-2 rounded-lg text-white text-sm disabled:opacity-50"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Final Result ── */}
      {step === "final" && (
        <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2 overflow-auto">
          <div className="camera-body rounded-xl p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-sm text-gray-600">Cyber-shot</span>
              <span className="font-lcd text-sm lcd-text bg-black/80 px-2 py-1 rounded">COMPLETE</span>
            </div>

            {/* Result preview */}
            <div className="lcd-screen rounded-lg p-3 flex-1 overflow-auto flex items-center justify-center">
              {filmStripReady ? (
                <img src={filmStripDataUrl} alt="Film strip" className="max-w-full max-h-full object-contain rounded" />
              ) : (
                <div className="w-full h-64 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="font-lcd text-lg lcd-text">PROCESSING...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <button
                onClick={downloadFilmStrip}
                disabled={!filmStripReady}
                className="shutter-btn flex-1 py-3 rounded-lg font-display text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                {isNative ? "SAVE" : "DOWNLOAD"}
              </button>

              {!isNative && (
                <button
                  onClick={printFilmStrip}
                  disabled={!filmStripReady}
                  className="camera-btn flex-1 py-3 rounded-lg font-display text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Printer className="w-5 h-5" />
                  PRINT
                </button>
              )}

              {isNative && (
                <button
                  onClick={sharePhoto}
                  disabled={!filmStripReady}
                  className="camera-btn px-4 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              )}

              <button onClick={reset} className="camera-btn px-4 py-3 rounded-lg flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                NEW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvases */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={filmStripCanvasRef} className="hidden" />
    </div>
  );
}
