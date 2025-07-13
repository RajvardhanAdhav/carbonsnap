import { useState, useRef, useEffect } from 'react';
import { Camera, X, Scan, Check, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { productClassificationService } from '@/services/productClassificationService';

interface BarcodeScannerProps {
  onBarcodeDetected: (barcode: string, productData?: any) => void;
  onCancel: () => void;
  isActive: boolean;
}

export function BarcodeScanner({ onBarcodeDetected, onCancel, isActive }: BarcodeScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [productData, setProductData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive]);

  useEffect(() => {
    if (stream && videoRef.current && scanning) {
      scanIntervalRef.current = setInterval(() => {
        scanForBarcode();
      }, 500);
    } else {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [stream, scanning]);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setScanning(true);
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const scanForBarcode = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Simulate barcode detection
    // In a real implementation, you would use a barcode detection library like:
    // - QuaggaJS
    // - ZXing-js
    // - @zxing/library
    const simulatedBarcode = await simulateBarcodeDetection(canvas);
    
    if (simulatedBarcode) {
      setDetectedBarcode(simulatedBarcode);
      setScanning(false);
      
      // Fetch product data
      try {
        const product = await productClassificationService.searchProductByBarcode(simulatedBarcode);
        setProductData(product);
      } catch (error) {
        console.error('Error fetching product data:', error);
      }
    }
  };

  // Simulated barcode detection for demo purposes
  const simulateBarcodeDetection = async (canvas: HTMLCanvasElement): Promise<string | null> => {
    // In a real implementation, this would analyze the canvas for barcode patterns
    // For demo, we'll return a random barcode occasionally
    if (Math.random() < 0.1) { // 10% chance each scan
      const mockBarcodes = [
        '0123456789012',
        '1234567890123',
        '2345678901234',
        '3456789012345'
      ];
      return mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
    }
    return null;
  };

  const handleBarcodeConfirm = () => {
    if (detectedBarcode) {
      onBarcodeDetected(detectedBarcode, productData);
    }
  };

  const handleRetry = () => {
    setDetectedBarcode(null);
    setProductData(null);
    setScanning(true);
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-eco-primary" />
            <h3 className="text-lg font-semibold">Barcode Scanner</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error ? (
          <div className="text-center space-y-4">
            <div className="text-destructive text-sm">{error}</div>
            <Button onClick={startCamera}>
              <Camera className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Scanner Status */}
            <div className="flex items-center justify-center gap-2 py-2">
              <Badge variant={scanning ? "default" : detectedBarcode ? "outline" : "secondary"} 
                     className={scanning ? "bg-eco-primary" : ""}>
                {scanning ? "Scanning..." : detectedBarcode ? "Barcode Detected" : "Ready"}
              </Badge>
            </div>

            {/* Camera View */}
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-64 object-cover rounded-lg bg-muted"
              />
              
              {/* Scanning Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`border-2 border-dashed w-64 h-16 rounded-lg transition-colors ${
                  scanning ? 'border-eco-primary animate-pulse' : 
                  detectedBarcode ? 'border-success bg-success/10' : 'border-muted-foreground'
                }`}>
                  <div className="w-full h-full flex items-center justify-center">
                    {scanning && (
                      <div className="w-48 h-1 bg-eco-primary animate-pulse"></div>
                    )}
                    {detectedBarcode && (
                      <Check className="h-8 w-8 text-success" />
                    )}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <Badge variant="secondary" className="bg-black/50 text-white border-none">
                  {scanning ? "Position barcode in the frame" : 
                   detectedBarcode ? "Barcode captured!" : "Initializing..."}
                </Badge>
              </div>
            </div>

            {/* Detected Product Info */}
            {detectedBarcode && (
              <Card className="p-4 bg-eco-light/20 border-eco-primary/30">
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-eco-primary mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">Barcode:</span>
                      <Badge variant="outline">{detectedBarcode}</Badge>
                    </div>
                    
                    {productData ? (
                      <div className="space-y-1">
                        <p className="font-medium">{productData.name}</p>
                        <p className="text-sm text-muted-foreground">{productData.description}</p>
                        {productData.category && (
                          <Badge variant="secondary">{productData.category}</Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Fetching product information...
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* Controls */}
            <div className="flex gap-3">
              {detectedBarcode ? (
                <>
                  <Button onClick={handleBarcodeConfirm} className="flex-1 bg-gradient-eco">
                    <Check className="mr-2 h-4 w-4" />
                    Use This Product
                  </Button>
                  <Button variant="outline" onClick={handleRetry}>
                    Scan Again
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={scanning ? () => setScanning(false) : () => setScanning(true)}
                  className="flex-1"
                >
                  {scanning ? 'Stop Scanning' : 'Start Scanning'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}