/**
 * Sony Cyber-shot Style Photobooth
 * Design: Retro digital camera aesthetic inspired by Sony Cyber-shot
 * Features: Full-screen camera, front/back toggle, draggable stickers, QR sharing
 */


import { Input } from "@/components/ui/input";
import { Camera, Download, RotateCcw, RefreshCw, ZoomIn, ZoomOut, X, Check, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";


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
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [layout, setLayout] = useState<LayoutType>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stickers, setStickers] = useState<StickerPosition[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [selectedPlacedSticker, setSelectedPlacedSticker] = useState<string | null>(null);
  const [eventText, setEventText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [filmStripReady, setFilmStripReady] = useState(false);
  const [filmStripDataUrl, setFilmStripDataUrl] = useState("");
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [step, setStep] = useState<"layout" | "camera" | "stickers" | "final">("layout");
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stickerPage, setStickerPage] = useState(0);
  const [cameraFilter, setCameraFilter] = useState<CameraFilter>("original");
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const photosNeeded = layout === "single" ? 1 : 4;
  const stickersPerPage = 7;
  const totalStickerPages = Math.ceil(STICKERS.length / stickersPerPage);

  // Initialize camera
  const startCamera = useCallback(async (facing: FacingMode = facingMode) => {
    setCameraError("");
    setCameraReady(false);
    
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => setCameraReady(true))
              .catch((err) => setCameraError("Failed to start video: " + err.message));
          }
        };
      }
    } catch (err: any) {
      setCameraError(err.message || "Camera access denied");
    }
  }, [stream, facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, [stream]);

  // Toggle camera
  const toggleCamera = async () => {
    const newFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacing);
    await startCamera(newFacing);
  };

  // Start capture - manual for single, auto for strip
  const startCapture = () => {
    if (layout === "strip") {
      // Start automatic sequential capture for strip mode
      setIsAutoCapturing(true);
      setCurrentPhotoIndex(0);
      setCountdown(3);
    } else {
      // Single photo - just countdown and capture
      setCountdown(3);
    }
  };

  // Handle countdown and auto-capture sequence
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown reached 0, capture photo
      capturePhotoForSequence();
    }
  }, [countdown]);

  // Capture photo and handle sequence
  const capturePhotoForSequence = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    if (cameraFilter === "retro") {
      applyRetroFilter(ctx, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const newPhotos = [...photos, { dataUrl, timestamp: new Date() }];
    setPhotos(newPhotos);
    
    const nextIndex = currentPhotoIndex + 1;
    setCurrentPhotoIndex(nextIndex);

    if (newPhotos.length >= photosNeeded) {
      // All photos captured
      setIsAutoCapturing(false);
      setCountdown(null);
      stopCamera();
      setStep("stickers");
    } else if (isAutoCapturing && layout === "strip") {
      // More photos needed in strip mode - start next countdown after brief pause
      setTimeout(() => {
        setCountdown(3);
      }, 800); // Brief pause between photos
    } else {
      setCountdown(null);
    }
  };

  // Apply retro filter to image data
  const applyRetroFilter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Warm sepia-like tone with slight desaturation
      data[i] = Math.min(255, r * 1.1 + 20);     // Red boost
      data[i + 1] = Math.min(255, g * 0.95 + 10); // Slight green reduction
      data[i + 2] = Math.min(255, b * 0.85);      // Blue reduction for warmth
      
      // Add slight contrast
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.1 + 128));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.1 + 128));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.1 + 128));
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add vignette effect
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, height * 0.3,
      width / 2, height / 2, height * 0.8
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add film grain
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let j = 0; j < 3000; j++) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let j = 0; j < 2000; j++) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }
  };



  // Add sticker
  const addSticker = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!selectedSticker || !previewContainerRef.current) return;
    
    const rect = previewContainerRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    const newSticker: StickerPosition = {
      id: Date.now().toString(),
      type: selectedSticker,
      x,
      y,
      rotation: Math.random() * 20 - 10,
      scale: 1,
    };
    
    setStickers((prev) => [...prev, newSticker]);
    setSelectedPlacedSticker(newSticker.id);
    setSelectedSticker(null);
  };

  // Update sticker position
  const updateStickerPosition = (id: string, updates: Partial<StickerPosition>) => {
    setStickers((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
  };

  // Delete sticker
  const deleteSticker = (id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
    setSelectedPlacedSticker(null);
  };

  // Resize sticker
  const resizeSticker = (id: string, delta: number) => {
    setStickers((prev) => prev.map((s) => {
      if (s.id === id) {
        const newScale = Math.max(0.3, Math.min(2.5, s.scale + delta));
        return { ...s, scale: newScale };
      }
      return s;
    }));
  };

  // Handle sticker drag
  const handleStickerDrag = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, stickerId: string) => {
    e.stopPropagation();
    if (!previewContainerRef.current) return;
    
    setSelectedPlacedSticker(stickerId);
    
    const rect = previewContainerRef.current.getBoundingClientRect();
    
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      let clientX: number, clientY: number;
      
      if ('touches' in moveEvent) {
        clientX = moveEvent.touches[0].clientX;
        clientY = moveEvent.touches[0].clientY;
      } else {
        clientX = moveEvent.clientX;
        clientY = moveEvent.clientY;
      }
      
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      
      updateStickerPosition(stickerId, { x, y });
    };
    
    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  };

  // Generate preview
  const generatePreview = useCallback(async () => {
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
    
    const photoSectionHeight = isSingle 
      ? photoHeight 
      : photos.length * (photoHeight + spacing) - spacing;
    
    const totalHeight = headerHeight + photoSectionHeight + footerHeight + margin * 2;
    
    canvas.width = stripWidth;
    canvas.height = totalHeight;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, stripWidth, totalHeight);

    // Film grain
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

      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(margin - 5, currentY - 5, photoWidth + 10, photoHeight + 10);
      
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
      
      ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
      for (let j = 0; j < 500; j++) {
        ctx.fillRect(margin + Math.random() * photoWidth, currentY + Math.random() * photoHeight, 1, 1);
      }

      currentY += photoHeight + spacing;
    }

    // Footer with custom text
    const footerY = currentY - spacing;
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 28px 'Orbitron', sans-serif";
    const footerTextDisplay = footerText || "CYBER-SHOT";
    const textWidth = ctx.measureText(footerTextDisplay.toUpperCase()).width;
    ctx.fillText(footerTextDisplay.toUpperCase(), (stripWidth - textWidth) / 2, footerY + 50);
    
    ctx.font = "16px 'Share Tech Mono', monospace";
    ctx.fillStyle = "#666666";
    const dateStr = eventDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
    const dateWidth = ctx.measureText(dateStr).width;
    ctx.fillText(dateStr, (stripWidth - dateWidth) / 2, footerY + 80);

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
    
    const photoSectionHeight = isSingle 
      ? photoHeight 
      : photos.length * (photoHeight + spacing) - spacing;
    
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

      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(margin - 5, currentY - 5, photoWidth + 10, photoHeight + 10);
      
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
      
      ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
      for (let j = 0; j < 500; j++) {
        ctx.fillRect(margin + Math.random() * photoWidth, currentY + Math.random() * photoHeight, 1, 1);
      }

      currentY += photoHeight + spacing;
    }

    // Draw stickers
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

    // Footer
    const footerY = currentY - spacing;
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 28px 'Orbitron', sans-serif";
    const footerTextDisplay = footerText || "CYBER-SHOT";
    const textWidth = ctx.measureText(footerTextDisplay.toUpperCase()).width;
    ctx.fillText(footerTextDisplay.toUpperCase(), (stripWidth - textWidth) / 2, footerY + 50);
    
    ctx.font = "16px 'Share Tech Mono', monospace";
    ctx.fillStyle = "#666666";
    const dateStr = eventDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
    const dateWidth = ctx.measureText(dateStr).width;
    ctx.fillText(dateStr, (stripWidth - dateWidth) / 2, footerY + 80);

    const dataUrl = canvas.toDataURL("image/png");
    setFilmStripDataUrl(dataUrl);
    setFilmStripReady(true);
    

  }, [photos, layout, eventText, footerText, stickers]);

  // Download
  const downloadFilmStrip = () => {
    if (!filmStripDataUrl) return;
    
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `cybershot-${timestamp}.png`;
    link.href = filmStripDataUrl;
    link.click();
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

  // Get current page stickers
  const currentStickers = STICKERS.slice(stickerPage * stickersPerPage, (stickerPage + 1) * stickersPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#b0b0b0] to-[#909090]">
      {/* Step 1: Layout Selection */}
      {step === "layout" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="camera-body rounded-2xl p-6 max-w-md w-full">
            {/* Camera top */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-display text-gray-600 tracking-wider">Cyber-shot</div>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 shadow-inner"></div>
                <div className="w-8 h-3 rounded bg-gray-400 shadow-inner"></div>
              </div>
            </div>
            
            {/* LCD Screen */}
            <div className="lcd-screen rounded-lg p-4 mb-4">
              <div className="scanlines absolute inset-0 rounded-lg"></div>
              <h1 className="font-display text-2xl lcd-text-orange text-center mb-2">
                PHOTOBOOTH
              </h1>
              <p className="font-lcd text-lg lcd-text text-center mb-4">
                SELECT MODE
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => selectLayout("single")}
                  className="camera-btn rounded-lg p-4 hover:bg-gray-200 transition-all"
                >
                  <div className="aspect-square bg-gray-300 rounded mb-2 flex items-center justify-center border-2 border-gray-400">
                    <Camera className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="font-mono text-xs font-bold text-gray-700">1 PHOTO</p>
                </button>
                
                <button
                  onClick={() => selectLayout("strip")}
                  className="camera-btn rounded-lg p-4 hover:bg-gray-200 transition-all"
                >
                  <div className="aspect-square bg-gray-300 rounded mb-2 flex flex-col gap-1 p-2 border-2 border-gray-400">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex-1 bg-gray-400 rounded" />
                    ))}
                  </div>
                  <p className="font-mono text-xs font-bold text-gray-700">4 PHOTOS</p>
                </button>
              </div>
            </div>
            
            {/* SONY branding */}
            <div className="text-center">
              <span className="font-display text-xl font-bold metallic-text">SONY</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Camera - Full Screen */}
      {step === "camera" && (
        <div className="fixed inset-0 bg-black flex flex-col">
          {/* Video preview */}
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ 
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
                filter: cameraFilter === "retro" ? "sepia(0.3) contrast(1.1) saturate(0.9) brightness(1.05)" : "none"
              }}
            />

            {/* LCD overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top bar */}
              <div className="absolute top-0 left-0 right-0 bg-black/60 p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="font-lcd text-sm lcd-text">REC</span>
                </div>
                <span className="font-lcd text-lg lcd-text-orange">
                  {photos.length}/{photosNeeded}
                </span>
                <span className="font-mono text-xs lcd-text">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>

              {/* Countdown */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {layout === "strip" && (
                      <p className="font-lcd text-2xl lcd-text-orange mb-2">
                        PHOTO {photos.length + 1} OF 4
                      </p>
                    )}
                    <span className="font-display text-9xl text-white drop-shadow-2xl animate-pulse">
                      {countdown || "📸"}
                    </span>
                  </div>
                </div>
              )}

              {/* Flash */}
              {flash && <div className="absolute inset-0 bg-white" />}
            </div>

            {/* Camera not ready */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-center">
                  <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="font-lcd text-xl lcd-text">INITIALIZING...</p>
                </div>
              </div>
            )}

            {/* Camera error */}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-center p-4">
                  <p className="font-lcd text-lg lcd-text-red mb-4">{cameraError}</p>
                  <button onClick={() => startCamera()} className="camera-btn px-6 py-3 rounded-lg font-mono">
                    RETRY
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="bg-gradient-to-t from-[#2a2a2a] to-[#1a1a1a] p-4 pb-8">
            {/* Event name input */}
            <div className="mb-4">
              <Input
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                placeholder="EVENT NAME (optional)"
                className="bg-black/50 border-gray-600 text-white font-mono text-center placeholder:text-gray-500"
                maxLength={25}
              />
            </div>
            
            {/* Filter toggle */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                onClick={() => setCameraFilter("original")}
                className={`px-4 py-2 rounded-lg font-mono text-xs transition-all ${
                  cameraFilter === "original"
                    ? "bg-orange-500 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                ORIGINAL
              </button>
              <button
                onClick={() => setCameraFilter("retro")}
                className={`px-4 py-2 rounded-lg font-mono text-xs transition-all ${
                  cameraFilter === "retro"
                    ? "bg-orange-500 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                RETRO
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-6">
              {/* Cancel */}
              <button
                onClick={reset}
                disabled={isAutoCapturing}
                className="camera-btn w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-30"
              >
                <X className="w-6 h-6 text-gray-700" />
              </button>

              {/* Shutter */}
              <button
                onClick={startCapture}
                disabled={!cameraReady || countdown !== null || isAutoCapturing}
                className="shutter-btn w-20 h-20 rounded-full flex items-center justify-center disabled:opacity-50"
              >
                <div className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center">
                  {layout === "strip" && !isAutoCapturing && (
                    <span className="font-mono text-xs text-white/70">AUTO</span>
                  )}
                </div>
              </button>

              {/* Flip camera */}
              <button
                onClick={toggleCamera}
                disabled={isAutoCapturing}
                className="camera-btn w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-30"
              >
                <RefreshCw className="w-6 h-6 text-gray-700" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Add Stickers */}
      {step === "stickers" && (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#b0b0b0] to-[#909090]">
          <div className="camera-body m-2 rounded-xl p-3 flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-xs text-gray-600">Cyber-shot</span>
              <span className="font-lcd text-sm lcd-text-orange bg-black/80 px-2 py-1 rounded">
                EDIT MODE
              </span>
            </div>

            {/* Preview area */}
            <div className="lcd-screen rounded-lg p-2 flex-1 flex flex-col overflow-hidden">
              <div
                ref={previewContainerRef}
                className="relative bg-white rounded flex-1 overflow-hidden"
                onClick={addSticker}
                onTouchEnd={(e) => {
                  if (selectedSticker) {
                    addSticker(e);
                  }
                }}
              >
                {previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
                  </div>
                )}
                
                {/* Placed stickers */}
                {stickers.map((sticker) => (
                  <div
                    key={sticker.id}
                    className={`absolute cursor-move touch-none ${selectedPlacedSticker === sticker.id ? 'ring-2 ring-orange-500 ring-offset-2' : ''}`}
                    style={{
                      left: `${sticker.x}%`,
                      top: `${sticker.y}%`,
                      transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
                    }}
                    onMouseDown={(e) => handleStickerDrag(e, sticker.id)}
                    onTouchStart={(e) => handleStickerDrag(e, sticker.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlacedSticker(sticker.id);
                    }}
                  >
                    <img
                      src={STICKERS.find((s) => s.type === sticker.type)?.src}
                      alt={sticker.type}
                      className="w-16 h-16 pointer-events-none"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>

              {/* Sticker controls when selected */}
              {selectedPlacedSticker && (
                <div className="flex items-center justify-center gap-2 mt-2 p-2 bg-black/50 rounded">
                  <button
                    onClick={() => resizeSticker(selectedPlacedSticker, -0.2)}
                    className="camera-btn p-2 rounded"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => resizeSticker(selectedPlacedSticker, 0.2)}
                    className="camera-btn p-2 rounded"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => deleteSticker(selectedPlacedSticker)}
                    className="camera-btn p-2 rounded bg-red-100"
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </button>
                  <button
                    onClick={() => setSelectedPlacedSticker(null)}
                    className="camera-btn p-2 rounded bg-green-100"
                  >
                    <Check className="w-5 h-5 text-green-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Footer text input */}
            <div className="mt-2">
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="CUSTOM TEXT (e.g., NUS EE Class of '25)"
                className="bg-gray-200 border-gray-400 font-mono text-sm text-center"
                maxLength={30}
              />
            </div>

            {/* Sticker selector */}
            <div className="mt-2 p-2 bg-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-gray-600">TAP TO SELECT, THEN TAP PREVIEW</span>
                <div className="flex gap-1">
                  {Array.from({ length: totalStickerPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStickerPage(i)}
                      className={`w-2 h-2 rounded-full ${stickerPage === i ? 'bg-orange-500' : 'bg-gray-400'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {currentStickers.map((sticker) => (
                  <button
                    key={sticker.type}
                    onClick={() => {
                      setSelectedSticker(sticker.type);
                      setSelectedPlacedSticker(null);
                    }}
                    className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 transition-all ${
                      selectedSticker === sticker.type
                        ? "border-orange-500 bg-orange-100 scale-110"
                        : "border-gray-300 bg-white hover:border-orange-300"
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

            {/* Action buttons */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={moveToFinal}
                className="shutter-btn flex-1 py-3 rounded-lg font-display text-white text-sm"
              >
                GENERATE
              </button>
              <button
                onClick={reset}
                className="camera-btn px-4 py-3 rounded-lg"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Final Result */}
      {step === "final" && (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#b0b0b0] to-[#909090] p-2">
          <div className="camera-body rounded-xl p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-sm text-gray-600">Cyber-shot</span>
              <span className="font-lcd text-sm lcd-text bg-black/80 px-2 py-1 rounded">
                COMPLETE
              </span>
            </div>

            {/* Result preview */}
            <div className="lcd-screen rounded-lg p-3 flex-1 overflow-auto">
              {filmStripReady ? (
                <img
                  src={filmStripDataUrl}
                  alt="Film strip"
                  className="w-full h-auto rounded"
                />
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
            <div className="flex gap-2 mt-3">
              <button
                onClick={downloadFilmStrip}
                disabled={!filmStripReady}
                className="shutter-btn flex-1 py-3 rounded-lg font-display text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                DOWNLOAD
              </button>
              <button
                onClick={reset}
                className="camera-btn px-4 py-3 rounded-lg flex items-center gap-2"
              >
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
