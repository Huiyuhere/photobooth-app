/*
 * Sony Cyber-shot Style Photobooth
 * Design: Retro digital camera aesthetic inspired by Sony Cyber-shot
 * Features: Full-screen camera, front/back toggle, draggable stickers, QR sharing
 */


import { Input } from "@/components/ui/input";
import { Camera, Download, RotateCcw, RefreshCw, ZoomIn, ZoomOut, X, Check, Trash2, Share2, Printer } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";


type LayoutType = "single" | "strip" | null;
type FacingMode = "user" | "environment";
type CameraFilter = "original" | "retro";

interface CapturedPhoto {
  dataUrl: string;
  timestamp: Date;
}

interface StickerPosition {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

const STICKERS = [
  { type: "resistor", src: "/images/sticker-resistor.png", label: "Resistor" },
  { type: "capacitor", src: "/images/sticker-capacitor.png", label: "Capacitor" },
  { type: "led", src: "/images/sticker-led.png", label: "LED" },
  { type: "circuit", src: "/images/sticker-circuit.png", label: "Circuit" },
  { type: "oscilloscope", src: "/images/sticker-oscilloscope.png", label: "Scope" },
  { type: "transistor", src: "/images/sticker-transistor.png", label: "Transistor" },
  { type: "chip", src: "/images/sticker-chip.png", label: "Chip" },
  { type: "battery", src: "/images/sticker-battery.png", label: "Battery" },
  { type: "soldering", src: "/images/sticker-soldering.png", label: "Solder" },
  { type: "multimeter", src: "/images/sticker-multimeter.png", label: "Meter" },
  { type: "smiley", src: "/images/sticker-smiley.png", label: "Smiley" },
  { type: "star", src: "/images/sticker-star.png", label: "Star" },
  { type: "heart", src: "/images/sticker-heart.png", label: "Heart" },
  { type: "rainbow", src: "/images/sticker-rainbow.png", label: "Rainbow" },
];

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filmStripCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [step, setStep] = useState<"layout" | "camera" | "stickers" | "final">("layout");
  const [layout, setLayout] = useState<LayoutType>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [cameraError, setCameraError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stickers, setStickers] = useState<StickerPosition[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [selectedPlacedSticker, setSelectedPlacedSticker] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [filmStripDataUrl, setFilmStripDataUrl] = useState("");
  const [filmStripReady, setFilmStripReady] = useState(false);
  const [eventText, setEventText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [cameraFilter, setCameraFilter] = useState<CameraFilter>("original");
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Start camera
  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Camera error:", error);
      setCameraError("Unable to access camera. Please check permissions.");
    }
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Toggle camera
  const toggleCamera = () => {
    stopCamera();
    setFacingMode(facingMode === "user" ? "environment" : "user");
  };

  // Apply retro filter
  const applyRetroFilter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Warm color overlay
    ctx.fillStyle = "rgba(255, 200, 100, 0.08)";
    ctx.fillRect(0, 0, width, height);

    // Vignette effect
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height));
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Film grain
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 2;
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.1})`;
      ctx.fillRect(x, y, size, size);
    }
  };

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    ctx.drawImage(videoRef.current, 0, 0);

    if (cameraFilter === "retro") {
      applyRetroFilter(ctx, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL("image/png");
    setPhotos((prev) => [...prev, { dataUrl, timestamp: new Date() }]);
  }, [cameraFilter]);

  // Auto capture for strip mode
  useEffect(() => {
    if (!isAutoCapturing || !layout || layout !== "strip") return;

    const captureSequence = async () => {
      for (let i = 0; i < 4; i++) {
        setCurrentPhotoIndex(i);

        // Countdown
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
      setStep("stickers");
    };

    captureSequence();
  }, [isAutoCapturing, layout, capturePhoto]);

  // Generate preview
  const generatePreview = useCallback(async () => {
    if (photos.length === 0 || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isSingle = layout === "single";

    const stripWidth = 600;
    const photoWidth = 560;
    const photoHeight = isSingle ? 560 : 400;
    const margin = 20;
    const headerHeight = 100;
    const footerHeight = 100;
    const spacing = 10;

    const photoSectionHeight = isSingle ? photoHeight : photos.length * (photoHeight + spacing) - spacing;

    const totalHeight = headerHeight + photoSectionHeight + footerHeight + margin * 2;

    canvas.width = stripWidth;
    canvas.height = totalHeight;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, stripWidth, totalHeight);

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

    // Draw photos
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const img = new Image();
      img.src = photo.dataUrl;

      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      const photoX = margin + (photoWidth - 560) / 2;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(photoX - 5, currentY - 5, 560 + 10, photoHeight + 10);

      ctx.drawImage(img, photoX, currentY, 560, photoHeight);
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
    ctx.fillText(footerText.toUpperCase() || "MEMORIES MADE", margin + 15, currentY + 65);

    ctx.fillStyle = "#666666";
    const dateStr = eventDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
    const dateWidth = ctx.measureText(dateStr).width;
    ctx.fillText(dateStr, (stripWidth - dateWidth) / 2, currentY + 80);

    setPreviewDataUrl(canvas.toDataURL("image/png"));
  }, [photos, layout, eventText, footerText]);

  // Generate final film strip with stickers
  const generateFilmStrip = useCallback(async () => {
    if (photos.length === 0 || !filmStripCanvasRef.current) return;

    const canvas = filmStripCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isSingle = layout === "single";

    const stripWidth = 600;
    const photoWidth = 560;
    const photoHeight = isSingle ? 560 : 400;
    const margin = 20;
    const headerHeight = 100;
    const footerHeight = 100;
    const spacing = 10;

    const photoSectionHeight = isSingle ? photoHeight : photos.length * (photoHeight + spacing) - spacing;

    const totalHeight = headerHeight + photoSectionHeight + footerHeight + margin * 2;

    canvas.width = stripWidth;
    canvas.height = totalHeight;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, stripWidth, totalHeight);

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

    // Draw photos
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const img = new Image();
      img.src = photo.dataUrl;

      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      const photoX = margin + (photoWidth - 560) / 2;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(photoX - 5, currentY - 5, 560 + 10, photoHeight + 10);

      ctx.drawImage(img, photoX, currentY, 560, photoHeight);
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
    ctx.fillText(footerText.toUpperCase() || "MEMORIES MADE", margin + 15, currentY + 65);

    ctx.fillStyle = "#666666";
    const dateStr = eventDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
    const dateWidth = ctx.measureText(dateStr).width;
    ctx.fillText(dateStr, (stripWidth - dateWidth) / 2, currentY + 80);

    // Draw stickers
    for (const sticker of stickers) {
      const stickerImg = new Image();
      stickerImg.src = STICKERS.find((s) => s.type === sticker.type)?.src || "";

      await new Promise((resolve) => {
        stickerImg.onload = resolve;
        stickerImg.onerror = resolve;
      });

      const stickerWidth = 80 * sticker.scale;
      const stickerHeight = 80 * sticker.scale;

      ctx.save();
      ctx.translate(sticker.x + stickerWidth / 2, sticker.y + stickerHeight / 2);
      ctx.rotate((sticker.rotation * Math.PI) / 180);
      ctx.drawImage(stickerImg, -stickerWidth / 2, -stickerHeight / 2, stickerWidth, stickerHeight);
      ctx.restore();
    }

    const dataUrl = canvas.toDataURL("image/png");
    setFilmStripDataUrl(dataUrl);
    setFilmStripReady(true);
  }, [photos, layout, eventText, footerText, stickers]);

  // Check if running in native app
  const isNative = Capacitor.isNativePlatform();

  // Save to gallery (native) or download (web)
  const downloadFilmStrip = async () => {
    if (!filmStripDataUrl) return;

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `cybershot-${timestamp}.png`;

    if (isNative) {
      try {
        // Convert data URL to base64
        const base64Data = filmStripDataUrl.split(",")[1];

        // Save to device gallery
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
        });

        // Show success feedback
        alert("Photo saved to gallery!");
        console.log("Saved to:", result.uri);
      } catch (error) {
        console.error("Error saving photo:", error);
        alert("Failed to save photo. Please try again.");
      }
    } else {
      // Web fallback - improved download for mobile and desktop
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
      } catch (error) {
        console.error("Download error:", error);
        const link = document.createElement("a");
        link.href = filmStripDataUrl;
        link.download = fileName;
        link.click();
      }
    }
  };

  // Print photo (web only)
  const printFilmStrip = () => {
    if (!filmStripDataUrl) return;

    const printWindow = window.open("", "", "width=800,height=600");
    if (printWindow) {
      const htmlContent = `<html><head><title>Cyber-shot Booth Photo</title><style>body { margin: 0; padding: 20px; background: white; } img { max-width: 100%; height: auto; display: block; margin: 0 auto; } @media print { body { padding: 0; } }</style></head><body><img src="${filmStripDataUrl}" /></body></html>`;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // Share photo (native only)
  const sharePhoto = async () => {
    if (!filmStripDataUrl || !isNative) return;

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `cybershot-${timestamp}.png`;
      const base64Data = filmStripDataUrl.split(",")[1];

      // Save temporarily for sharing
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

  // Reset
  const reset = () => {
    setLayout(null);
    setPhotos([]);
    setStickers([]);
    setEventText("");
    setFooterText("");
    setFilmStripReady(false);
    setFilmStripDataUrl("");
    setPreviewDataUrl("");
    setStep("layout");
    setCameraError("");
    setSelectedSticker(null);
    setSelectedPlacedSticker(null);
    setCameraFilter("original");
    setIsAutoCapturing(false);
    setCurrentPhotoIndex(0);
    setCountdown(null);
    stopCamera();
  };

  // Toggle filter
  const toggleFilter = () => {
    setCameraFilter(cameraFilter === "original" ? "retro" : "original");
  };

  const selectLayout = (type: LayoutType) => {
    setLayout(type);
    setStep("camera");
  };

  const moveToFinal = () => {
    setStep("final");
    generateFilmStrip();
  };

  useEffect(() => {
    if (step === "camera") {
      startCamera();
    }
  }, [step]);

  useEffect(() => {
    if (step === "stickers" && photos.length > 0) {
      generatePreview();
    }
  }, [step, photos, generatePreview, eventText, footerText]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const handleStickerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedSticker) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newSticker: StickerPosition = {
      id: `sticker-${Date.now()}`,
      type: selectedSticker,
      x,
      y,
      rotation: 0,
      scale: 1,
    };

    setStickers([...stickers, newSticker]);
  };

  const handleStickerDrag = (id: string, dx: number, dy: number) => {
    setStickers(
      stickers.map((s) =>
        s.id === id
          ? {
              ...s,
              x: Math.max(0, Math.min(600 - 80 * s.scale, s.x + dx)),
              y: Math.max(0, Math.min(600 - 80 * s.scale, s.y + dy)),
            }
          : s
      )
    );
  };

  const handleStickerResize = (id: string, scale: number) => {
    setStickers(stickers.map((s) => (s.id === id ? { ...s, scale: Math.max(0.5, Math.min(2, scale)) } : s)));
  };

  const handleStickerRotate = (id: string, rotation: number) => {
    setStickers(stickers.map((s) => (s.id === id ? { ...s, rotation } : s)));
  };

  const deleteSticker = (id: string) => {
    setStickers(stickers.filter((s) => s.id !== id));
    setSelectedPlacedSticker(null);
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-[#b0b0b0] to-[#909090] flex items-center justify-center p-2">
      {/* Step 1: Layout Selection */}
      {step === "layout" && (
        <div className="camera-body rounded-xl p-4 w-full max-w-md flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm text-gray-600">Cyber-shot</span>
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
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
                <div className="flex flex-col gap-1 mx-auto mb-2">
                  <div className="w-8 h-2 bg-gray-400 rounded"></div>
                  <div className="w-8 h-2 bg-gray-400 rounded"></div>
                  <div className="w-8 h-2 bg-gray-400 rounded"></div>
                  <div className="w-8 h-2 bg-gray-400 rounded"></div>
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

      {/* Step 2: Camera */}
      {step === "camera" && (
        <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2">
          <div className="camera-body rounded-xl p-4 flex-1 flex flex-col h-[80dvh]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-sm text-gray-600">Cyber-shot</span>
              <span className="font-lcd text-sm lcd-text bg-black/80 px-2 py-1 rounded">REC</span>
            </div>

            {/* Camera View */}
            <div className="lcd-screen rounded-lg flex-1 overflow-hidden mb-3 flex items-center justify-center bg-black relative">
              {!stream && cameraError && (
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

              {stream && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${cameraFilter === "retro" ? "brightness-110 contrast-125 saturate-150" : ""}`}
                  style={{
                    transform: "scaleX(-1)",
                  }}
                />
              )}
            </div>

            {/* Controls - Fixed at bottom */}
            <div className="fixed bottom-0 left-0 right-0 h-[180px] bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2 flex flex-col gap-2 overflow-auto">
              <div className="flex gap-2">
                <button
                  onClick={toggleCamera}
                  disabled={!stream}
                  className="camera-btn flex-1 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  FLIP
                </button>

                <button
                  onClick={toggleFilter}
                  className={`flex-1 py-2 rounded-lg font-display text-white text-sm ${
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
                      capturePhoto();
                      setTimeout(() => setStep("stickers"), 500);
                    }
                  }}
                  disabled={!stream}
                  className="shutter-btn flex-1 py-3 rounded-lg font-display text-white text-sm disabled:opacity-50"
                >
                  {countdown !== null ? `${countdown}` : layout === "strip" ? "START SEQUENCE" : "CAPTURE"}
                </button>
              </div>

              {layout === "strip" && (
                <div className="text-center font-lcd text-sm lcd-text">
                  {isAutoCapturing ? `PHOTO ${currentPhotoIndex + 1} OF 4` : ""}
                </div>
              )}

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

      {/* Step 3: Stickers */}
      {step === "stickers" && (
        <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2 overflow-auto">
          <div className="camera-body rounded-xl p-4 flex-1 flex flex-col h-[80dvh]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-sm text-gray-600">Cyber-shot</span>
              <span className="font-lcd text-sm lcd-text bg-black/80 px-2 py-1 rounded">EDIT</span>
            </div>

            {/* Preview */}
            <div className="lcd-screen rounded-lg flex-1 overflow-auto mb-3 flex items-center justify-center bg-black relative">
              {previewDataUrl && (
                <div
                  className="relative cursor-crosshair"
                  onClick={handleStickerClick}
                  style={{
                    backgroundImage: `url(${previewDataUrl})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  {stickers.map((sticker) => {
                    const stickerData = STICKERS.find((s) => s.type === sticker.type);
                    return (
                      <div
                        key={sticker.id}
                        className={`absolute cursor-move ${selectedPlacedSticker === sticker.id ? "ring-2 ring-yellow-400" : ""}`}
                        style={{
                          left: `${sticker.x}px`,
                          top: `${sticker.y}px`,
                          width: `${80 * sticker.scale}px`,
                          height: `${80 * sticker.scale}px`,
                          transform: `rotate(${sticker.rotation}deg)`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlacedSticker(sticker.id);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const startY = e.clientY;

                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const dx = moveEvent.clientX - startX;
                            const dy = moveEvent.clientY - startY;
                            handleStickerDrag(sticker.id, dx, dy);
                          };

                          const handleMouseUp = () => {
                            document.removeEventListener("mousemove", handleMouseMove);
                            document.removeEventListener("mouseup", handleMouseUp);
                          };

                          document.addEventListener("mousemove", handleMouseMove);
                          document.addEventListener("mouseup", handleMouseUp);
                        }}
                      >
                        <img src={stickerData?.src} alt={sticker.type} className="w-full h-full" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticker Controls - Fixed at bottom */}
            <div className="fixed bottom-0 left-0 right-0 h-[180px] bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2 flex flex-col gap-2 overflow-auto">
              <div className="flex gap-2 flex-wrap">
                {STICKERS.map((sticker) => (
                  <button
                    key={sticker.type}
                    onClick={() => setSelectedSticker(selectedSticker === sticker.type ? null : sticker.type)}
                    className={`w-12 h-12 rounded-lg border-2 ${
                      selectedSticker === sticker.type ? "border-yellow-400 bg-yellow-100" : "border-gray-300 bg-white"
                    } flex items-center justify-center hover:border-yellow-400 transition`}
                    title={sticker.label}
                  >
                    <img src={sticker.src} alt={sticker.label} className="w-8 h-8" />
                  </button>
                ))}
              </div>

              {selectedPlacedSticker && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStickerRotate(selectedPlacedSticker, (stickers.find((s) => s.id === selectedPlacedSticker)?.rotation || 0) + 15)}
                    className="camera-btn flex-1 py-2 rounded-lg text-sm"
                  >
                    ROTATE
                  </button>
                  <button
                    onClick={() => handleStickerResize(selectedPlacedSticker, (stickers.find((s) => s.id === selectedPlacedSticker)?.scale || 1) + 0.2)}
                    className="camera-btn flex-1 py-2 rounded-lg text-sm"
                  >
                    BIGGER
                  </button>
                  <button
                    onClick={() => handleStickerResize(selectedPlacedSticker, (stickers.find((s) => s.id === selectedPlacedSticker)?.scale || 1) - 0.2)}
                    className="camera-btn flex-1 py-2 rounded-lg text-sm"
                  >
                    SMALLER
                  </button>
                  <button
                    onClick={() => deleteSticker(selectedPlacedSticker)}
                    className="camera-btn px-2 py-2 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <input
                type="text"
                placeholder="Footer text (optional)"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm bg-white/80"
              />

              <div className="flex gap-2">
                <button onClick={reset} className="camera-btn flex-1 py-2 rounded-lg text-sm">
                  BACK
                </button>
                <button onClick={moveToFinal} className="shutter-btn flex-1 py-2 rounded-lg text-white text-sm">
                  DONE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Final Result */}
      {step === "final" && (
        <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2 overflow-auto">
          <div className="camera-body rounded-xl p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-sm text-gray-600">Cyber-shot</span>
              <span className="font-lcd text-sm lcd-text bg-black/80 px-2 py-1 rounded">COMPLETE</span>
            </div>

            {/* Result preview */}
            <div className="lcd-screen rounded-lg p-3 flex-1 overflow-auto">
              {filmStripReady ? (
                <img src={filmStripDataUrl} alt="Film strip" className="w-full h-auto rounded" />
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
      <canvas ref={previewCanvasRef} className="hidden" />
    </div>
  );
}
