/**
 * Share page - Preview and download shared photobooth images
 */

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Share() {
  const [location] = useLocation();
  const [imageData, setImageData] = useState<string>("");

  useEffect(() => {
    // Extract data from URL params
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");
    if (data) {
      setImageData(decodeURIComponent(data));
    }
  }, [location]);

  const downloadImage = () => {
    if (!imageData) return;
    
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `photobooth-${timestamp}.png`;
    link.href = imageData;
    link.click();
  };

  if (!imageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="font-mono text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2 drop-shadow-lg">
            Shared Memories
          </h1>
          <p className="font-mono text-xs text-muted-foreground tracking-wider">
            VIEW · DOWNLOAD · ENJOY
          </p>
        </div>

        {/* Image preview */}
        <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-4 border-white">
          <div className="bg-white rounded-xl p-4 mb-6 max-h-[600px] overflow-y-auto">
            <img
              src={imageData}
              alt="Shared photobooth"
              className="w-full h-auto"
            />
          </div>

          {/* Download button */}
          <Button
            onClick={downloadImage}
            size="lg"
            className="w-full font-mono text-lg py-6 rounded-xl"
          >
            <Download className="mr-2" />
            Download to Device
          </Button>
        </div>
      </div>
    </div>
  );
}
