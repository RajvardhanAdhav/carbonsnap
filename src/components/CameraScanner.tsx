import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RotateCcw, Check, X, Focus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
// Removed OCR imports - now using direct Base64 to OpenAI

interface CameraScannerProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export default function CameraScanner({ onCapture, onCancel, isProcessing }: CameraScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startCamera();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    console.log('🧹 Cleaning up camera resources...');
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log('🔌 Stopping track:', track.kind, track.readyState);
        track.stop();
      });
      setStream(null);
    }
  };

  // Removed OCR detection effects - simplified for direct OpenAI processing

  const startCamera = async () => {
    try {
      console.log('📹 Starting camera...');
      setCameraError(null);
      
      // Clean up any existing stream first
      if (stream) {
        console.log('🔄 Cleaning up existing stream...');
        stream.getTracks().forEach(track => track.stop());
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        }
      });
      
      console.log('✅ Camera access granted, setting up stream...');
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log('📺 Video element connected to stream');
      }
    } catch (error) {
      console.error('❌ Error accessing camera:', error);
      let errorMessage = 'Unable to access camera. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Camera permission denied. Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Camera does not support the requested resolution.';
      } else {
        errorMessage += 'Please check permissions or upload an image instead.';
      }
      
      setCameraError(errorMessage);
    }
  };

  // Removed frame analysis - no longer needed for OCR detection

  const capturePhoto = async () => {
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

    // Convert to base64 - ready for OpenAI
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    
    // Restart camera if needed
    if (!stream || !stream.active) {
      console.log('Restarting camera after retake...');
      startCamera();
    }
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
          <div className="text-center space-y-4 p-6 border border-destructive/20 rounded-lg bg-destructive/5">
            <div className="text-destructive font-medium">{cameraError}</div>
            <div className="text-muted-foreground text-sm">
              Don't worry! You can still upload an image to scan your receipt.
            </div>
            <div className="space-y-3">
              <Button 
                onClick={() => fileInputRef.current?.click()}
                size="lg"
                className="w-full bg-eco-primary hover:bg-eco-primary/90"
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload Image to Scan
              </Button>
              <Button 
                onClick={startCamera}
                variant="outline"
                className="w-full"
              >
                <Camera className="mr-2 h-4 w-4" />
                Try Camera Again
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,image/jpeg,image/jpg,image/png"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        ) : (
          <>
            {/* Simplified camera view - no detection needed */}

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
                  <div className="absolute inset-0 border-2 border-dashed rounded-lg pointer-events-none border-eco-primary/50">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white bg-black/50 rounded px-2 py-1 text-sm">
                      Position receipt in frame
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img 
                    src={capturedImage} 
                    alt="Captured receipt" 
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
                    {isProcessing ? 'Processing...' : 'Process Receipt'}
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