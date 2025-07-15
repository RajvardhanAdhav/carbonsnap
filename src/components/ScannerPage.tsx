import { useState } from "react";
import { Camera, Upload, Scan, Receipt, ArrowLeft, CheckCircle, Edit, Loader2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import CameraScanner from "./CameraScanner";
import ManualInputModal from "./ManualInputModal";
import { BarcodeScanner } from "./enhanced/BarcodeScanner";
import { ReductionTipsEngine } from "./enhanced/ReductionTipsEngine";

type ScanMode = "receipt" | "barcode";

const ScannerPage = () => {
  const { user, session } = useAuth();
  const [scanMode, setScanMode] = useState<ScanMode>("receipt");
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showReductionTips, setShowReductionTips] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const processImage = async (imageData: string, scanMethod: string = 'camera') => {
    if (!user || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    setIsScanning(true);
    
    try {
      if (scanMode === 'receipt') {
        const { data, error } = await supabase.functions.invoke('process-receipt', {
          body: { imageData, scanMethod },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;
        setScanResult({ type: 'receipt', ...data.data });
      }
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setIsScanning(false);
      setShowCamera(false);
    }
  };

  const handleManualSubmit = async (data: any) => {
    if (!user || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    setIsScanning(true);
    
    try {
      // Only process manual receipt data now
      const { data: result, error } = await supabase.functions.invoke('process-receipt', {
        body: { 
          imageData: 'manual-input',
          scanMethod: 'manual',
          manualData: data
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setScanResult({ type: 'receipt', ...result.data });
    } catch (error) {
      console.error('Error processing manual input:', error);
      alert('Failed to process input. Please try again.');
    } finally {
      setIsScanning(false);
      setShowManualInput(false);
    }
  };

  const handleBarcodeDetected = async (barcode: string, productData?: any) => {
    if (!user || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    setIsScanning(true);
    setShowBarcodeScanner(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('scan-barcode', {
        body: { 
          barcode,
          scanMethod: 'barcode'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setScanResult({ type: 'item', ...data.data });
    } catch (error) {
      console.error('Error processing barcode:', error);
      alert('Failed to process barcode. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const getCarbonColor = (category: string) => {
    switch (category) {
      case "low": return "carbon-low";
      case "medium": return "carbon-medium";
      case "high": return "carbon-high";
      default: return "muted";
    }
  };

  const getCarbonBadge = (category: string) => {
    switch (category) {
      case "low": return "Low Impact";
      case "medium": return "Medium Impact";
      case "high": return "High Impact";
      default: return "Unknown";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-semibold">Carbon Scanner</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {showCamera ? (
          <CameraScanner
            onCapture={(imageData) => processImage(imageData, 'camera')}
            onCancel={() => setShowCamera(false)}
            isProcessing={isScanning}
          />
        ) : !scanResult ? (
          <>
            {/* Scan Mode Selection */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-center mb-6">What would you like to scan?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
                <Card 
                  className={`p-6 text-center cursor-pointer transition-all border-2 ${
                    scanMode === "receipt" 
                      ? "border-eco-primary bg-eco-primary/5" 
                      : "border-border hover:border-eco-primary/50"
                  }`}
                  onClick={() => setScanMode("receipt")}
                >
                  <Receipt className="h-12 w-12 mx-auto mb-4 text-eco-primary" />
                  <h3 className="font-semibold mb-2">Receipt</h3>
                  <p className="text-sm text-muted-foreground">Scan entire shopping receipt with AI</p>
                </Card>

                <Card 
                  className={`p-6 text-center cursor-pointer transition-all border-2 ${
                    scanMode === "barcode" 
                      ? "border-eco-primary bg-eco-primary/5" 
                      : "border-border hover:border-eco-primary/50"
                  }`}
                  onClick={() => setScanMode("barcode")}
                >
                  <Scan className="h-12 w-12 mx-auto mb-4 text-eco-primary" />
                  <h3 className="font-semibold mb-2">Barcode</h3>
                  <p className="text-sm text-muted-foreground">Scan barcode for product data</p>
                </Card>
              </div>
            </div>

            {/* Scanner Options */}
            <Card className="p-8 text-center border-dashed border-2 border-eco-primary/30 bg-eco-light/30">
              <div className="space-y-6">
                <div className="relative mx-auto w-32 h-32 bg-eco-primary/10 rounded-full flex items-center justify-center">
                  <Camera className="h-16 w-16 text-eco-primary" />
                  {isScanning && (
                    <div className="absolute inset-0 rounded-full border-4 border-eco-primary/30 border-t-eco-primary animate-spin" />
                  )}
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold mb-2">
                    {isScanning ? "Processing..." : `Ready to scan ${scanMode}`}
                  </h3>
                  <p className="text-muted-foreground">
                    {isScanning 
                      ? "Processing and calculating carbon footprint..."
                      : `Use your camera to scan a ${scanMode} or enter data manually`
                    }
                  </p>
                </div>

                <div className="space-y-3">
                  {scanMode === "barcode" ? (
                    <Button 
                      onClick={() => setShowBarcodeScanner(true)}
                      disabled={isScanning}
                      size="lg" 
                      className="w-full bg-gradient-eco hover:opacity-90"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Scan className="mr-2 h-5 w-5" />
                          Scan Barcode
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => setShowCamera(true)}
                      disabled={isScanning}
                      size="lg" 
                      className="w-full bg-gradient-eco hover:opacity-90"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Camera className="mr-2 h-5 w-5" />
                          Open Camera
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowManualInput(true)}
                    disabled={isScanning}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Manual Input
                  </Button>
                </div>
              </div>
            </Card>
          </>
        ) : (
          /* Scan Results */
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-center gap-2 text-success">
              <CheckCircle className="h-6 w-6" />
              <span className="font-semibold">Scan Complete!</span>
            </div>

            {scanResult.type === "receipt" ? (
              /* Receipt Results */
              <div className="space-y-4">
                <Card className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{scanResult.store}</h3>
                      <p className="text-muted-foreground">{scanResult.date}</p>
                    </div>
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {scanResult.totalCarbon} kg CO₂e
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {scanResult.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{item.carbon} kg CO₂e</p>
                          <Badge 
                            variant="outline" 
                            className={`text-xs text-${getCarbonColor(item.category)}`}
                          >
                            {getCarbonBadge(item.category)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ) : (
              /* Item Results */
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold">{scanResult.name}</h3>
                    <p className="text-muted-foreground">{scanResult.brand}</p>
                    <div className="mt-4">
                      <div className="text-3xl font-bold text-eco-primary mb-2">
                        {scanResult.carbon} kg CO₂e
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-${getCarbonColor(scanResult.category)}`}
                      >
                        {getCarbonBadge(scanResult.category)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Material</p>
                      <p>{scanResult.details.material}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Origin</p>
                      <p>{scanResult.details.origin}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Transport</p>
                      <p>{scanResult.details.transport}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Packaging</p>
                      <p>{scanResult.details.packaging}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                onClick={() => {setScanResult(null); setIsScanning(false);}}
              >
                Scan Another
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowReductionTips(true)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Get Tips
              </Button>
              <Link to="/dashboard">
                <Button className="w-full bg-gradient-eco hover:opacity-90">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Barcode Scanner */}
        {showBarcodeScanner && (
          <BarcodeScanner
            onBarcodeDetected={handleBarcodeDetected}
            onCancel={() => setShowBarcodeScanner(false)}
            isActive={showBarcodeScanner}
          />
        )}

        {/* Reduction Tips Modal */}
        {showReductionTips && scanResult && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-background rounded-lg w-full max-w-4xl mt-8 mb-8">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Reduction Tips</h2>
                  <Button variant="ghost" onClick={() => setShowReductionTips(false)}>
                    ×
                  </Button>
                </div>
                <ReductionTipsEngine
                  items={scanResult.type === 'receipt' ? scanResult.items : [scanResult]}
                  totalEmissions={scanResult.type === 'receipt' ? scanResult.totalCarbon : scanResult.carbon}
                />
              </div>
            </div>
          </div>
        )}

        {/* Manual Input Modal */}
        <ManualInputModal
          isOpen={showManualInput}
          onClose={() => setShowManualInput(false)}
          onSubmit={handleManualSubmit}
          isLoading={isScanning}
        />
      </div>
    </div>
  );
};

export default ScannerPage;