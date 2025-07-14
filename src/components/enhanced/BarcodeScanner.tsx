import { useState, useRef, useEffect } from 'react';
import { Camera, X, Scan, Check, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { productClassificationService } from '@/services/productClassificationService';
// @ts-ignore - Quagga library doesn't have proper TypeScript definitions
import Quagga from 'quagga';

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
  const [isLoading, setIsLoading] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  
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
      }, 1000); // Reduced frequency for better performance
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
      setIsLoading(true);
      
      // Try multiple camera configurations with fallbacks
      const cameraConfigs = [
        { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        { 
          facingMode: 'environment',
          width: { ideal: 720 },
          height: { ideal: 480 }
        },
        { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        { 
          facingMode: 'environment' // Basic fallback
        },
        { 
          // Last resort - use any available camera
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      ];

      let mediaStream: MediaStream | null = null;
      
      for (const config of cameraConfigs) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: config
          });
          break; // Success, exit loop
        } catch (configError) {
          console.log(`Camera config failed, trying next:`, configError);
          continue; // Try next configuration
        }
      }

      if (!mediaStream) {
        throw new Error('No camera configuration worked');
      }
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setScanning(true);
          setIsLoading(false);
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please check permissions and ensure your device has a camera.');
      setIsLoading(false);
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
    if (!videoRef.current || !canvasRef.current || !scanning) return;

    // Debounce scanning to prevent multiple rapid scans
    const now = Date.now();
    if (now - lastScanTime < 800) return; // Minimum 800ms between scans
    setLastScanTime(now);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0) return;

    // Optimize canvas size for better performance
    const scale = Math.min(800 / video.videoWidth, 600 / video.videoHeight);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to image data for Quagga
    const imageData = canvas.toDataURL('image/jpeg', 0.7);
    
    try {
      await new Promise<void>((resolve, reject) => {
        Quagga.decodeSingle({
          src: imageData,
          numOfWorkers: 0,
          inputStream: {
            size: Math.min(canvas.width, canvas.height)
          },
          locator: {
            patchSize: "small", // Better for mobile performance
            halfSample: false // Better accuracy for small barcodes
          },
          decoder: {
            readers: [
              "ean_reader",      // EAN-13 (most common)
              "ean_8_reader",    // EAN-8
              "upc_reader",      // UPC-A
              "upc_e_reader",    // UPC-E
              "code_128_reader", // Code 128
              "code_39_reader"   // Code 39
            ]
          },
          locate: true,
          multiple: false
        }, (result) => {
          if (result && result.codeResult) {
            const barcode = result.codeResult.code;
            const format = result.codeResult.format;
            
            console.log(`Detected ${format} barcode: ${barcode}`);
            
            // Enhanced barcode validation - accept both numeric and alphanumeric
            if (barcode && barcode.length >= 6 && /^[0-9A-Za-z]+$/.test(barcode)) {
              setDetectedBarcode(barcode);
              setScanning(false);
              setIsLoading(true);
              
              // Fetch product data with timeout
              const fetchTimeout = setTimeout(() => {
                setIsLoading(false);
                setProductData(null);
              }, 10000); // 10 second timeout
              
              productClassificationService.searchProductByBarcode(barcode)
                .then((data) => {
                  clearTimeout(fetchTimeout);
                  setProductData(data);
                  setIsLoading(false);
                })
                .catch((error) => {
                  clearTimeout(fetchTimeout);
                  console.error('Error fetching product data:', error);
                  setProductData(null);
                  setIsLoading(false);
                });
            }
          }
          resolve();
        });
      });
    } catch (error) {
      console.error('Barcode scanning error:', error);
    }
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
              <Button onClick={startCamera} disabled={isLoading}>
                <Camera className="mr-2 h-4 w-4" />
                {isLoading ? 'Starting...' : 'Try Again'}
              </Button>
            </div>
          ) : (
          <>
            {/* Scanner Status */}
            <div className="flex items-center justify-center gap-2 py-2">
              <Badge variant={scanning ? "default" : detectedBarcode ? "outline" : "secondary"} 
                     className={scanning ? "bg-eco-primary animate-pulse" : ""}>
                {isLoading ? "Loading..." : scanning ? "Scanning..." : detectedBarcode ? "Barcode Detected" : "Ready"}
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
                    
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-eco-primary border-t-transparent rounded-full"></div>
                        <p className="text-sm text-muted-foreground">
                          Fetching product information...
                        </p>
                      </div>
                    ) : productData ? (
                      <div className="space-y-1">
                        <p className="font-medium">{productData.name}</p>
                        <p className="text-sm text-muted-foreground">{productData.description}</p>
                        {productData.category && (
                          <Badge variant="secondary">{productData.category}</Badge>
                        )}
                        {productData.brand && (
                          <p className="text-xs text-muted-foreground">by {productData.brand}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Product not found in database. You can still use this barcode.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* Manual Barcode Input */}
            {!detectedBarcode && !scanning && !isLoading && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Or enter a barcode manually:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter product barcode (UPC/EAN)"
                    className="flex-1 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-eco-primary focus:border-eco-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const barcode = (e.target as HTMLInputElement).value.trim();
                        if (barcode && barcode.length >= 6) {
                          setDetectedBarcode(barcode);
                          setIsLoading(true);
                          productClassificationService.searchProductByBarcode(barcode)
                            .then((data) => {
                              setProductData(data);
                              setIsLoading(false);
                            })
                            .catch((error) => {
                              console.error('Error fetching product data:', error);
                              setProductData(null);
                              setIsLoading(false);
                            });
                        }
                      }
                    }}
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const input = document.querySelector('input[placeholder*="barcode"]') as HTMLInputElement;
                      if (input && input.value.trim().length >= 6) {
                        const barcode = input.value.trim();
                        setDetectedBarcode(barcode);
                        setIsLoading(true);
                        productClassificationService.searchProductByBarcode(barcode)
                          .then((data) => {
                            setProductData(data);
                            setIsLoading(false);
                          })
                          .catch((error) => {
                            console.error('Error fetching product data:', error);
                            setProductData(null);
                            setIsLoading(false);
                          });
                      }
                    }}
                  >
                    Search
                  </Button>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3">
              {detectedBarcode ? (
                <>
                  <Button 
                    onClick={handleBarcodeConfirm} 
                    className="flex-1 bg-gradient-eco"
                    disabled={isLoading}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Use This Product
                  </Button>
                  <Button variant="outline" onClick={handleRetry} disabled={isLoading}>
                    Scan Again
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={scanning ? () => setScanning(false) : () => setScanning(true)}
                  className="flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : scanning ? 'Stop Scanning' : 'Start Scanning'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}