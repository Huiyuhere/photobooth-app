/**
 * Y2K Digital Nostalgia Photobooth
 * Design: Early 2000s digital camera aesthetic with retro film strip output
 * Workflow: Choose layout → Take photos → Add stickers → Generate QR & Download
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Download, RotateCcw, Sparkles, Image as ImageIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type LayoutType = "single" | "strip" | null;

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
  { type: "smiley", src: "/images/sticker-smiley.png", label: "😊" },
  { type: "star", src: "/images/sticker-star.png", label: "⭐" },
  { type: "heart", src: "/images/sticker-heart.png", label: "💖" },
  { type: "rainbow", src: "/images/sticker-rainbow.png", label: "🌈" },
];

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filmStripCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [layout, setLayout] = useState<LayoutType>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stickers, setStickers] = useState<StickerPosition[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [eventText, setEventText] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [filmStripReady, setFilmStripReady] = useState(false);
  const [filmStripDataUrl, setFilmStripDataUrl] = useState("");
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [step, setStep] = useState<"layout" | "camera" | "stickers" | "final">("layout");
  const [cameraError, setCameraError] = useState("");

  const photosNeeded = layout === "single" ? 1 : 4;

  // Initialize camera
  const startCamera = useCallback(async () => {
    setCameraError("");
    setCameraReady(false);
    
    try {
      // Stop any existing stream first
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          facingMode: "user",
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: false,
      };

      console.log("Requesting camera access...");
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera stream obtained:", mediaStream.getVideoTracks()[0].label);
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video to be ready to play
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log("Video playing");
                setCameraReady(true);
              })
              .catch((err) => {
                console.error("Error playing video:", err);
                setCameraError("Failed to start video playback");
              });
          }
        };
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(err.message || "Camera access denied. Please allow camera permissions.");
    }
  }, [stream]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("Stopped track:", track.label);
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, [stream]);

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) {
      console.log("Cannot capture: video or canvas not ready");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log("Capturing photo:", canvas.width, "x", canvas.height);

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    
    // Flash effect
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    // Add to photos
    const newPhotos = [...photos, { dataUrl, timestamp: new Date() }];
    setPhotos(newPhotos);

    console.log("Photo captured, total:", newPhotos.length);

    // If we have enough photos, move to sticker step
    if (newPhotos.length >= photosNeeded) {
      stopCamera();
      setStep("stickers");
    }
  };

  // Add sticker to preview
  const addSticker = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedSticker || !previewContainerRef.current) return;
    
    const rect = previewContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newSticker: StickerPosition = {
      id: Date.now().toString(),
      type: selectedSticker,
      x,
      y,
      rotation: Math.random() * 30 - 15,
      scale: 0.8 + Math.random() * 0.4,
    };
    
    setStickers((prev) => [...prev, newSticker]);
  };

  // Generate preview (without stickers) for sticker placement step
  const generatePreview = useCallback(async () => {
    if (photos.length === 0 || !filmStripCanvasRef.current) return;

    const canvas = filmStripCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isSingle = layout === "single";
    
    // Canvas dimensions
    const stripWidth = 600;
    const photoWidth = 560;
    const photoHeight = isSingle ? 560 : 400;
    const margin = 20;
    const headerHeight = 100;
    const dateHeight = 60;
    const footerHeight = 180;
    const spacing = 10;
    
    const photoSectionHeight = isSingle 
      ? photoHeight 
      : photos.length * (photoHeight + spacing) - spacing;
    
    const totalHeight = headerHeight + photoSectionHeight + dateHeight + footerHeight + margin * 2;
    
    canvas.width = stripWidth;
    canvas.height = totalHeight;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, stripWidth, totalHeight);

    // Film grain effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * stripWidth;
      const y = Math.random() * totalHeight;
      ctx.fillRect(x, y, 1, 1);
    }

    let currentY = margin + headerHeight;

    // Header with retro elements
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(margin, margin, photoWidth, headerHeight - 10);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px monospace";
    ctx.fillText("REC ● PLAY ▲ SP   LIVE CAM 01", margin + 15, margin + 35);
    
    // Date stamp in header
    const eventDate = photos[0].timestamp;
    const monthYear = eventDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
    ctx.fillStyle = "#ff9500";
    ctx.font = "bold 24px monospace";
    const dateText = `${monthYear} — ${eventText.toUpperCase() || "PARTY TIME"}`;
    ctx.fillText(dateText, margin + 15, margin + headerHeight - 25);

    // Draw photos
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const img = new Image();
      img.src = photo.dataUrl;
      
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      // Photo border
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(margin - 5, currentY - 5, photoWidth + 10, photoHeight + 10);
      
      // Draw photo (crop to fit)
      const imgAspect = img.width / img.height;
      const targetAspect = photoWidth / photoHeight;
      
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      
      if (imgAspect > targetAspect) {
        sw = img.height * targetAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetAspect;
        sy = (img.height - sh) / 2;
      }
      
      ctx.drawImage(img, sx, sy, sw, sh, margin, currentY, photoWidth, photoHeight);
      
      // Film grain on photo
      ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
      for (let j = 0; j < 800; j++) {
        const x = margin + Math.random() * photoWidth;
        const y = currentY + Math.random() * photoHeight;
        ctx.fillRect(x, y, 1, 1);
      }

      currentY += photoHeight + spacing;
    }

    // Footer with decorative stickers
    const footerY = currentY - spacing + dateHeight;
    
    // Load and draw footer stickers
    const decorStickers = [
      { src: "/images/sticker-star.png", x: margin + 30, y: footerY + 20, size: 60 },
      { src: "/images/sticker-heart.png", x: margin + 480, y: footerY + 30, size: 50 },
      { src: "/images/sticker-rainbow.png", x: margin + 420, y: footerY + 100, size: 70 },
      { src: "/images/sticker-smiley.png", x: margin + 50, y: footerY + 110, size: 55 },
    ];

    for (const sticker of decorStickers) {
      const img = new Image();
      img.src = sticker.src;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      ctx.drawImage(img, sticker.x, sticker.y, sticker.size, sticker.size);
    }

    // Footer text
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 48px cursive";
    ctx.fillText("MEMORIES", margin + 120, footerY + 80);
    
    ctx.font = "32px cursive";
    ctx.fillStyle = "#666666";
    ctx.fillText("Made with ♥", margin + 140, footerY + 130);

    const dataUrl = canvas.toDataURL("image/png");
    setPreviewDataUrl(dataUrl);
  }, [photos, layout, eventText]);

  // Generate final film strip with stickers
  const generateFilmStrip = useCallback(async () => {
    if (photos.length === 0 || !filmStripCanvasRef.current) return;

    const canvas = filmStripCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isSingle = layout === "single";
    
    // Canvas dimensions
    const stripWidth = 600;
    const photoWidth = 560;
    const photoHeight = isSingle ? 560 : 400;
    const margin = 20;
    const headerHeight = 100;
    const dateHeight = 60;
    const footerHeight = 180;
    const spacing = 10;
    
    const photoSectionHeight = isSingle 
      ? photoHeight 
      : photos.length * (photoHeight + spacing) - spacing;
    
    const totalHeight = headerHeight + photoSectionHeight + dateHeight + footerHeight + margin * 2;
    
    canvas.width = stripWidth;
    canvas.height = totalHeight;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, stripWidth, totalHeight);

    // Film grain effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * stripWidth;
      const y = Math.random() * totalHeight;
      ctx.fillRect(x, y, 1, 1);
    }

    let currentY = margin + headerHeight;

    // Header with retro elements
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(margin, margin, photoWidth, headerHeight - 10);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px monospace";
    ctx.fillText("REC ● PLAY ▲ SP   LIVE CAM 01", margin + 15, margin + 35);
    
    // Date stamp in header
    const eventDate = photos[0].timestamp;
    const monthYear = eventDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
    ctx.fillStyle = "#ff9500";
    ctx.font = "bold 24px monospace";
    const dateText = `${monthYear} — ${eventText.toUpperCase() || "PARTY TIME"}`;
    ctx.fillText(dateText, margin + 15, margin + headerHeight - 25);

    // Draw photos
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const img = new Image();
      img.src = photo.dataUrl;
      
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      // Photo border
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(margin - 5, currentY - 5, photoWidth + 10, photoHeight + 10);
      
      // Draw photo (crop to fit)
      const imgAspect = img.width / img.height;
      const targetAspect = photoWidth / photoHeight;
      
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      
      if (imgAspect > targetAspect) {
        sw = img.height * targetAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetAspect;
        sy = (img.height - sh) / 2;
      }
      
      ctx.drawImage(img, sx, sy, sw, sh, margin, currentY, photoWidth, photoHeight);
      
      // Film grain on photo
      ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
      for (let j = 0; j < 800; j++) {
        const x = margin + Math.random() * photoWidth;
        const y = currentY + Math.random() * photoHeight;
        ctx.fillRect(x, y, 1, 1);
      }

      currentY += photoHeight + spacing;
    }

    // Draw user-placed stickers
    for (const sticker of stickers) {
      const img = new Image();
      img.src = STICKERS.find((s) => s.type === sticker.type)?.src || "";
      
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      
      const stickerSize = 80 * sticker.scale;
      const x = (sticker.x / 100) * stripWidth - stickerSize / 2;
      const y = (sticker.y / 100) * totalHeight - stickerSize / 2;
      
      ctx.save();
      ctx.translate(x + stickerSize / 2, y + stickerSize / 2);
      ctx.rotate((sticker.rotation * Math.PI) / 180);
      ctx.drawImage(img, -stickerSize / 2, -stickerSize / 2, stickerSize, stickerSize);
      ctx.restore();
    }

    // Footer with decorative stickers
    const footerY = currentY - spacing + dateHeight;
    
    const decorStickers = [
      { src: "/images/sticker-star.png", x: margin + 30, y: footerY + 20, size: 60 },
      { src: "/images/sticker-heart.png", x: margin + 480, y: footerY + 30, size: 50 },
      { src: "/images/sticker-rainbow.png", x: margin + 420, y: footerY + 100, size: 70 },
      { src: "/images/sticker-smiley.png", x: margin + 50, y: footerY + 110, size: 55 },
    ];

    for (const sticker of decorStickers) {
      const img = new Image();
      img.src = sticker.src;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      ctx.drawImage(img, sticker.x, sticker.y, sticker.size, sticker.size);
    }

    // Footer text
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 48px cursive";
    ctx.fillText("MEMORIES", margin + 120, footerY + 80);
    
    ctx.font = "32px cursive";
    ctx.fillStyle = "#666666";
    ctx.fillText("Made with ♥", margin + 140, footerY + 130);

    const dataUrl = canvas.toDataURL("image/png");
    setFilmStripDataUrl(dataUrl);
    setFilmStripReady(true);
  }, [photos, layout, eventText, stickers]);

  // Download film strip
  const downloadFilmStrip = () => {
    if (!filmStripDataUrl) return;
    
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `photobooth-${timestamp}.png`;
    link.href = filmStripDataUrl;
    link.click();
  };

  // Reset everything
  const reset = () => {
    setLayout(null);
    setPhotos([]);
    setStickers([]);
    setEventText("");
    setFilmStripReady(false);
    setFilmStripDataUrl("");
    setPreviewDataUrl("");
    setStep("layout");
    setCameraError("");
    stopCamera();
  };

  // Handle layout selection
  const selectLayout = (type: LayoutType) => {
    setLayout(type);
    setStep("camera");
  };

  // Move to final step
  const moveToFinal = () => {
    setStep("final");
    generateFilmStrip();
  };

  // Start camera when entering camera step
  useEffect(() => {
    if (step === "camera") {
      startCamera();
    }
  }, [step]);

  // Generate preview when entering stickers step
  useEffect(() => {
    if (step === "stickers" && photos.length > 0) {
      generatePreview();
    }
  }, [step, photos, generatePreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url(/images/hero-background.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      
      {/* Film grain overlay */}
      <div className="fixed inset-0 -z-10 film-grain" />

      {/* Main content */}
      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2 drop-shadow-lg">
            Retro Photobooth
          </h1>
          <p className="font-mono text-xs text-muted-foreground tracking-wider">
            CAPTURE · DECORATE · SHARE
          </p>
        </div>

        {/* Step 1: Layout Selection */}
        {step === "layout" && (
          <div className="space-y-4">
            <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-4 border-white">
              <h2 className="font-display text-2xl text-foreground mb-4 text-center">
                Choose Your Layout
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => selectLayout("single")}
                  className="bg-white rounded-xl p-6 border-4 border-border hover:border-primary transition-all hover:scale-105 active:scale-95"
                >
                  <div className="aspect-square bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg mb-3 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-primary" />
                  </div>
                  <p className="font-mono text-sm font-bold text-foreground">1 PHOTO</p>
                </button>
                
                <button
                  onClick={() => selectLayout("strip")}
                  className="bg-white rounded-xl p-6 border-4 border-border hover:border-primary transition-all hover:scale-105 active:scale-95"
                >
                  <div className="aspect-square bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg mb-3 flex flex-col gap-1 p-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex-1 bg-primary/30 rounded" />
                    ))}
                  </div>
                  <p className="font-mono text-sm font-bold text-foreground">4 PHOTOS</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Camera */}
        {step === "camera" && (
          <div className="space-y-4">
            {/* Video preview */}
            <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />

              {/* Camera not ready overlay */}
              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center text-white">
                    <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="font-mono text-sm">Starting camera...</p>
                  </div>
                </div>
              )}

              {/* Camera error */}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center text-white p-4">
                    <p className="font-mono text-sm text-red-400 mb-4">{cameraError}</p>
                    <Button onClick={startCamera} variant="outline" size="sm">
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {/* Flash effect */}
              {flash && (
                <div className="absolute inset-0 bg-white" />
              )}
              
              {/* Photo counter */}
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-full px-4 py-2">
                <p className="font-mono text-white text-sm font-bold">
                  {photos.length} / {photosNeeded}
                </p>
              </div>
            </div>

            {/* Event name input */}
            <div className="bg-card/90 backdrop-blur-sm rounded-xl p-4 border-2 border-white">
              <Label htmlFor="event" className="font-mono text-sm font-bold mb-2 block">
                EVENT NAME (OPTIONAL)
              </Label>
              <Input
                id="event"
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                placeholder="e.g., CNY GATHERING"
                className="font-mono uppercase"
                maxLength={30}
              />
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <Button
                onClick={capturePhoto}
                disabled={!cameraReady}
                size="lg"
                className="flex-1 font-mono text-lg py-6 rounded-xl"
              >
                <Camera className="mr-2" />
                Capture
              </Button>
              <Button
                onClick={reset}
                variant="outline"
                size="lg"
                className="font-mono px-6 py-6 rounded-xl bg-card/90"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Add Stickers */}
        {step === "stickers" && (
          <div className="space-y-4">
            {/* Preview with stickers */}
            <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-4 shadow-2xl border-4 border-white">
              <h2 className="font-display text-2xl text-foreground mb-3 text-center">
                Add Stickers
              </h2>
              
              <div
                ref={previewContainerRef}
                className="relative bg-white rounded-xl overflow-hidden cursor-crosshair"
                onClick={addSticker}
              >
                {previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt="Preview"
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="w-full aspect-[3/4] flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                )}
                
                {/* Sticker overlays */}
                {stickers.map((sticker) => (
                  <img
                    key={sticker.id}
                    src={STICKERS.find((s) => s.type === sticker.type)?.src}
                    alt={sticker.type}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${sticker.x}%`,
                      top: `${sticker.y}%`,
                      transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
                      width: "60px",
                      height: "60px",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Sticker selector */}
            <div className="bg-card/90 backdrop-blur-sm rounded-xl p-4 border-2 border-white">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="font-mono text-xs font-bold text-foreground">
                  TAP STICKER, THEN TAP PREVIEW
                </span>
              </div>
              <div className="flex gap-3 justify-center">
                {STICKERS.map((sticker) => (
                  <button
                    key={sticker.type}
                    onClick={() => setSelectedSticker(sticker.type)}
                    className={`w-16 h-16 rounded-xl border-3 transition-all ${
                      selectedSticker === sticker.type
                        ? "border-primary scale-110 shadow-lg"
                        : "border-border hover:border-primary/50 hover:scale-105"
                    }`}
                  >
                    <img
                      src={sticker.src}
                      alt={sticker.label}
                      className="w-full h-full object-contain p-1"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <Button
                onClick={moveToFinal}
                size="lg"
                className="flex-1 font-mono text-lg py-6 rounded-xl"
              >
                Generate
              </Button>
              <Button
                onClick={reset}
                variant="outline"
                size="lg"
                className="font-mono px-6 py-6 rounded-xl bg-card/90"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Final Result with QR */}
        {step === "final" && (
          <div className="space-y-4">
            <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-4 border-white">
              <h2 className="font-display text-3xl text-foreground mb-4 text-center">
                Your Memories!
              </h2>

              {/* Film strip preview */}
              <div className="bg-white rounded-xl p-4 mb-6 max-h-[400px] overflow-y-auto">
                {filmStripReady ? (
                  <img
                    src={filmStripDataUrl}
                    alt="Film strip"
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="w-full aspect-[3/4] flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                      <p className="font-mono text-sm text-muted-foreground">Generating...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* QR Code */}
              {filmStripReady && (
                <div className="bg-white rounded-xl p-6 mb-6 text-center">
                  <p className="font-mono text-sm font-bold text-foreground mb-3">
                    SCAN TO VIEW & DOWNLOAD
                  </p>
                  <div className="inline-block p-4 bg-white rounded-lg border-2 border-gray-200">
                    <QRCodeSVG
                      value={window.location.origin}
                      size={180}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-3">
                    Or use the download button below
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={downloadFilmStrip}
                  disabled={!filmStripReady}
                  size="lg"
                  className="flex-1 font-mono text-lg py-6 rounded-xl"
                >
                  <Download className="mr-2" />
                  Download
                </Button>
                <Button
                  onClick={reset}
                  variant="outline"
                  size="lg"
                  className="font-mono px-6 py-6 rounded-xl bg-card/90"
                >
                  <RotateCcw className="mr-2" />
                  New
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden canvases */}
        <canvas ref={canvasRef} className="hidden" />
        <canvas ref={filmStripCanvasRef} className="hidden" />
      </div>
    </div>
  );
}
