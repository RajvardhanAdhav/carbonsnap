import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RotateCcw, Check, X, Focus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { detectReceipt, preprocessImageForOCR, calculateSharpness } from '@/utils/imageProcessing';

interface CameraScannerProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export default function CameraScanner({ onCapture, onCancel, isProcessing }: CameraScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoCapture, setAutoCapture] = useState(false);
  const [receiptDetected, setReceiptDetected] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  // Start real-time receipt detection when camera is active
  useEffect(() => {
    if (stream && videoRef.current && !capturedImage) {
      detectionIntervalRef.current = setInterval(() => {
        analyzeCurrentFrame();
      }, 500); // Check every 500ms
    } else {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [stream, capturedImage]);

  // Auto-capture when receipt is detected with high confidence
  useEffect(() => {
    if (autoCapture && receiptDetected && detectionConfidence > 0.7 && sharpness > 100 && !capturedImage) {
      autoTimerRef.current = setTimeout(() => {
        capturePhoto();
        setAutoCapture(false);
      }, 1000); // 1 second delay for stable detection
    }
    
    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
      }
    };
  }, [autoCapture, receiptDetected, detectionConfidence, sharpness, capturedImage]);

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

  const analyzeCurrentFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Analyze frame for receipt detection
    const detection = detectReceipt(canvas);
    const frameSharpness = calculateSharpness(canvas);

    setReceiptDetected(detection.isReceiptDetected);
    setDetectionConfidence(detection.confidence);
    setSharpness(frameSharpness);
    setSuggestions(detection.suggestions || []);
  };

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

    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);

    // Process image for OCR
    try {
      const processed = await preprocessImageForOCR(imageData);
      setProcessedImage(processed.processedDataUrl);
    } catch (error) {
      console.error('Error preprocessing image:', error);
      setProcessedImage(imageData); // Fallback to original
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setProcessedImage(null);
    
    // Clear any existing timers
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    
    // Reset detection state
    setReceiptDetected(false);
    setDetectionConfidence(0);
    setSharpness(0);
    setSuggestions([]);
    
    // Reset auto-capture if it was enabled
    setAutoCapture(false);
    
    // Restart camera if needed
    if (!stream || !stream.active) {
      console.log('Restarting camera after retake...');
      startCamera();
    }
  };

  const confirmPhoto = () => {
    if (processedImage) {
      onCapture(processedImage);
    } else if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        setCapturedImage(imageData);
        
        // Process uploaded image for OCR
        try {
          const processed = await preprocessImageForOCR(imageData);
          setProcessedImage(processed.processedDataUrl);
        } catch (error) {
          console.error('Error preprocessing uploaded image:', error);
          setProcessedImage(imageData); // Fallback to original
        }
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
            <div className="space-y-2">
              <Button 
                onClick={startCamera}
                variant="outline"
                className="w-full"
              >
                <Camera className="mr-2 h-4 w-4" />
                Try Camera Again
              </Button>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Image Instead
              </Button>
            </div>
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
            {/* Receipt Detection Status */}
            {!capturedImage && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Focus className="h-4 w-4" />
                    <span className="text-sm font-medium">Receipt Detection</span>
                  </div>
                  <Badge variant={receiptDetected ? "default" : "secondary"} className={receiptDetected ? "bg-eco-primary" : ""}>
                    {receiptDetected ? "Detected" : "Searching"}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Confidence</span>
                    <span>{Math.round(detectionConfidence * 100)}%</span>
                  </div>
                  <Progress value={detectionConfidence * 100} className="h-1" />
                  
                  <div className="flex items-center justify-between text-xs">
                    <span>Sharpness</span>
                    <span className={sharpness > 100 ? "text-eco-primary" : "text-muted-foreground"}>
                      {sharpness > 100 ? "Good" : "Poor"}
                    </span>
                  </div>
                  <Progress value={Math.min(100, sharpness / 2)} className="h-1" />
                </div>

                {suggestions.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {suggestions.map((suggestion, idx) => (
                      <div key={idx}>• {suggestion}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                  <div className={`absolute inset-0 border-2 border-dashed rounded-lg pointer-events-none transition-colors ${
                    receiptDetected ? 'border-eco-primary bg-eco-primary/10' : 'border-eco-primary/50'
                  }`}>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white bg-black/50 rounded px-2 py-1 text-sm">
                      {autoCapture && receiptDetected ? 
                        "Auto-capturing..." : 
                        receiptDetected ? 
                        "Receipt detected - ready to capture" : 
                        "Position receipt in frame"
                      }
                    </div>
                    
                    {receiptDetected && (
                      <div className="absolute top-2 right-2 bg-eco-primary text-white rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
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
                  
                  {processedImage && processedImage !== capturedImage && (
                    <div className="relative">
                      <p className="text-sm font-medium mb-2">Processed for OCR:</p>
                      <img 
                        src={processedImage} 
                        alt="Processed receipt" 
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                    </div>
                  )}
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
                    <Zap className="mr-2 h-4 w-4" />
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