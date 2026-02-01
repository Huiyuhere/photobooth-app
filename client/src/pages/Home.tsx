/**
 * Y2K Digital Nostalgia Photobooth
 * Design: Early 2000s digital camera aesthetic with retro film strip output
 * Colors: Soft pastel gradients with dark text for contrast
 * Typography: Permanent Marker (display), Space Mono (LCD/dates), DM Sans (body)
 * Features: Camera capture, sticker overlays, film strip with date stamps
 */

import { Button } from "@/components/ui/button";
import { Camera, Download, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stickers, setStickers] = useState<StickerPosition[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [flash, setFlash] = useState(false);
  const [filmStripReady, setFilmStripReady] = useState(false);

  // Initialize camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setShowCamera(true);
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Please allow camera access to use the photobooth!");
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw stickers on canvas
    stickers.forEach((sticker) => {
      const img = new Image();
      img.src = STICKERS.find((s) => s.type === sticker.type)?.src || "";
      
      const stickerSize = 120 * sticker.scale;
      const x = (sticker.x / 100) * canvas.width - stickerSize / 2;
      const y = (sticker.y / 100) * canvas.height - stickerSize / 2;
      
      ctx.save();
      ctx.translate(x + stickerSize / 2, y + stickerSize / 2);
      ctx.rotate((sticker.rotation * Math.PI) / 180);
      ctx.drawImage(img, -stickerSize / 2, -stickerSize / 2, stickerSize, stickerSize);
      ctx.restore();
    });

    // Get image data
    const dataUrl = canvas.toDataURL("image/png");
    
    // Flash effect
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    // Add to photos
    setPhotos((prev) => [...prev, { dataUrl, timestamp: new Date() }]);
    setStickers([]);
  };

  // Add sticker to canvas
  const addSticker = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedSticker) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
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

  // Generate film strip
  const generateFilmStrip = async () => {
    if (photos.length === 0 || !filmStripCanvasRef.current) return;

    const canvas = filmStripCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Film strip dimensions (portrait orientation like reference)
    const stripWidth = 600;
    const photoWidth = 560;
    const photoHeight = 400;
    const margin = 20;
    const headerHeight = 100;
    const dateHeight = 60;
    const footerHeight = 180;
    const spacing = 10;
    
    const totalHeight = headerHeight + photos.length * (photoHeight + spacing) + dateHeight + footerHeight + margin * 2;
    
    canvas.width = stripWidth;
    canvas.height = totalHeight;

    // Load background texture
    const bgImg = new Image();
    bgImg.src = "/images/hero-background.png";
    await new Promise((resolve) => {
      bgImg.onload = resolve;
    });

    // White background with texture
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, stripWidth, totalHeight);
    
    // Add subtle texture
    ctx.globalAlpha = 0.15;
    ctx.drawImage(bgImg, 0, 0, stripWidth, totalHeight);
    ctx.globalAlpha = 1;

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
    ctx.font = "bold 16px 'Space Mono', monospace";
    ctx.fillText("REC ● PLAY ▲ SP   LIVE CAM 01", margin + 15, margin + 35);
    
    // Date stamp in header
    const eventDate = photos[0].timestamp;
    const monthYear = eventDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
    ctx.fillStyle = "#ff9500";
    ctx.font = "bold 24px 'Space Mono', monospace";
    const dateText = `${monthYear} — PARTY TIME`;
    ctx.fillText(dateText, margin + 15, margin + headerHeight - 25);

    // Draw photos
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const img = new Image();
      img.src = photo.dataUrl;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Photo border
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(margin - 5, currentY - 5, photoWidth + 10, photoHeight + 10);
      
      // Draw photo
      ctx.drawImage(img, margin, currentY, photoWidth, photoHeight);
      
      // Film grain on photo
      ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
      for (let j = 0; j < 800; j++) {
        const x = margin + Math.random() * photoWidth;
        const y = currentY + Math.random() * photoHeight;
        ctx.fillRect(x, y, 1, 1);
      }

      currentY += photoHeight + spacing;
    }

    // Footer with stickers and text
    const footerY = currentY + dateHeight;
    
    // Load and draw sticker decorations
    const stickerPromises = [
      { src: "/images/sticker-star.png", x: margin + 30, y: footerY + 20, size: 60 },
      { src: "/images/sticker-heart.png", x: margin + 480, y: footerY + 30, size: 50 },
      { src: "/images/sticker-rainbow.png", x: margin + 420, y: footerY + 100, size: 70 },
      { src: "/images/sticker-smiley.png", x: margin + 50, y: footerY + 110, size: 55 },
    ];

    for (const sticker of stickerPromises) {
      const img = new Image();
      img.src = sticker.src;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      ctx.drawImage(img, sticker.x, sticker.y, sticker.size, sticker.size);
    }

    // Footer text
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 48px 'Permanent Marker', cursive";
    ctx.fillText("MEMORIES", margin + 120, footerY + 80);
    
    ctx.font = "32px 'Permanent Marker', cursive";
    ctx.fillStyle = "#666666";
    ctx.fillText("Made with ♥", margin + 140, footerY + 130);

    setFilmStripReady(true);
  };

  // Download film strip
  const downloadFilmStrip = () => {
    if (!filmStripCanvasRef.current) return;
    
    const canvas = filmStripCanvasRef.current;
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `photobooth-${timestamp}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Reset everything
  const reset = () => {
    setPhotos([]);
    setStickers([]);
    setFilmStripReady(false);
    stopCamera();
  };

  // Generate film strip when photos are added
  useEffect(() => {
    if (photos.length > 0) {
      generateFilmStrip();
    }
  }, [photos]);

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
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl md:text-6xl text-foreground mb-3 drop-shadow-lg">
            Retro Photobooth
          </h1>
          <p className="font-mono text-sm text-muted-foreground tracking-wider">
            CAPTURE · DECORATE · SHARE
          </p>
        </div>

        {/* Camera view */}
        {!showCamera && photos.length === 0 && (
          <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border-4 border-white">
            <div className="text-center space-y-6">
              <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Camera className="w-12 h-12 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-3xl text-foreground mb-2">
                  Ready to Snap?
                </h2>
                <p className="font-sans text-muted-foreground">
                  Create your retro film strip with fun stickers!
                </p>
              </div>
              <Button
                onClick={startCamera}
                size="lg"
                className="font-mono text-lg px-8 py-6 rounded-xl"
              >
                <Camera className="mr-2" />
                Start Camera
              </Button>
            </div>
          </div>
        )}

        {/* Camera interface */}
        {showCamera && (
          <div className="space-y-4">
            {/* Video preview with stickers */}
            <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto"
              />
              
              {/* Sticker overlay */}
              <div
                className="absolute inset-0 cursor-crosshair"
                onClick={addSticker}
              >
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
                      width: "80px",
                      height: "80px",
                    }}
                  />
                ))}
              </div>

              {/* Flash effect */}
              {flash && (
                <div className="absolute inset-0 bg-white animate-pulse" />
              )}
            </div>

            {/* Sticker selector */}
            <div className="bg-card/90 backdrop-blur-sm rounded-xl p-4 border-2 border-white">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="font-mono text-sm font-bold text-foreground">
                  TAP STICKER, THEN TAP VIDEO
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
                onClick={capturePhoto}
                size="lg"
                className="flex-1 font-mono text-lg py-6 rounded-xl"
              >
                <Camera className="mr-2" />
                Capture ({photos.length})
              </Button>
              <Button
                onClick={stopCamera}
                variant="outline"
                size="lg"
                className="font-mono px-6 py-6 rounded-xl bg-card/90"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Film strip preview */}
        {photos.length > 0 && !showCamera && (
          <div className="space-y-4">
            <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-4 border-white">
              <div className="text-center mb-4">
                <h2 className="font-display text-3xl text-foreground mb-2">
                  Your Film Strip!
                </h2>
                <p className="font-mono text-sm text-muted-foreground">
                  {photos.length} {photos.length === 1 ? "PHOTO" : "PHOTOS"} · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
                </p>
              </div>

              {/* Film strip canvas */}
              <div className="bg-white rounded-xl p-4 max-h-[600px] overflow-y-auto">
                <canvas
                  ref={filmStripCanvasRef}
                  className="w-full h-auto"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
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

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
