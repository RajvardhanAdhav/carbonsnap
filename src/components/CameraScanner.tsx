import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RotateCcw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface CameraScannerProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export default function CameraScanner({ onCapture, onCancel, isProcessing }: CameraScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoCapture, setAutoCapture] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
      }
    };
  }, []);

  // Auto-capture when enabled
  useEffect(() => {
    if (autoCapture && !capturedImage && videoRef.current) {
      autoTimerRef.current = setTimeout(() => {
        capturePhoto();
        setAutoCapture(false);
      }, 3000); // 3 second countdown
    }
    
    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
      }
    };
  }, [autoCapture, capturedImage]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraError('Unable to access camera. Please check permissions or upload an image instead.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setCapturedImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="space-y-4">
        {cameraError ? (
          <div className="text-center space-y-4">
            <div className="text-destructive text-sm">{cameraError}</div>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Image Instead
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        ) : (
          <>
            {/* Camera View */}
            <div className="relative">
              {!capturedImage ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-64 object-cover rounded-lg bg-muted"
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-eco-primary/50 rounded-lg pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white bg-black/50 rounded px-2 py-1 text-sm">
                      {autoCapture ? "Auto-capturing in 3 seconds..." : "Position receipt or item in frame"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img 
                    src={capturedImage} 
                    alt="Captured" 
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <div className="absolute top-2 right-2 bg-eco-primary text-white rounded-full p-1">
                    <Check className="h-4 w-4" />
                  </div>
                </div>
              )}
            </div>

            {/* Canvas for photo capture (hidden) */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Controls */}
            <div className="flex gap-3">
              {!capturedImage ? (
                <>
                  <Button onClick={capturePhoto} className="flex-1 bg-gradient-eco">
                    <Camera className="mr-2 h-4 w-4" />
                    Capture
                  </Button>
                  <Button 
                    variant={autoCapture ? "default" : "outline"}
                    onClick={() => setAutoCapture(!autoCapture)}
                    className={autoCapture ? "bg-eco-primary" : ""}
                  >
                    Auto
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </>
              ) : (
                <>
                  <Button 
                    onClick={confirmPhoto} 
                    disabled={isProcessing}
                    className="flex-1 bg-gradient-eco"
                  >
                    {isProcessing ? 'Processing...' : 'Use This Photo'}
                  </Button>
                  <Button variant="outline" onClick={retakePhoto}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retake
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}