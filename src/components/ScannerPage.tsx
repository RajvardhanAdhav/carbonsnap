import { useState } from "react";
import { Camera, Upload, Scan, Receipt, Package, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

type ScanMode = "receipt" | "item";

const ScannerPage = () => {
  const [scanMode, setScanMode] = useState<ScanMode>("receipt");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const mockScanReceipt = () => {
    setIsScanning(true);
    setTimeout(() => {
      setScanResult({
        type: "receipt",
        store: "Green Market",
        date: "2024-01-12",
        items: [
          { name: "Organic Apples", quantity: "2 lbs", carbon: 0.8, category: "low" },
          { name: "Beef Steak", quantity: "1 lb", carbon: 27.2, category: "high" },
          { name: "Plant Milk", quantity: "1 bottle", carbon: 0.9, category: "low" },
          { name: "Bread", quantity: "1 loaf", carbon: 1.2, category: "low" }
        ],
        totalCarbon: 30.1
      });
      setIsScanning(false);
    }, 2000);
  };

  const mockScanItem = () => {
    setIsScanning(true);
    setTimeout(() => {
      setScanResult({
        type: "item",
        name: "Organic Cotton T-Shirt",
        brand: "EcoWear",
        carbon: 5.4,
        category: "medium",
        details: {
          material: "100% Organic Cotton",
          origin: "Turkey",
          transport: "Sea freight",
          packaging: "Recycled cardboard"
        }
      });
      setIsScanning(false);
    }, 2000);
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
        {!scanResult ? (
          <>
            {/* Scan Mode Selection */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-center mb-6">What would you like to scan?</h2>
              <div className="grid grid-cols-2 gap-4">
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
                  <p className="text-sm text-muted-foreground">Scan entire shopping receipt</p>
                </Card>
                
                <Card 
                  className={`p-6 text-center cursor-pointer transition-all border-2 ${
                    scanMode === "item" 
                      ? "border-eco-primary bg-eco-primary/5" 
                      : "border-border hover:border-eco-primary/50"
                  }`}
                  onClick={() => setScanMode("item")}
                >
                  <Package className="h-12 w-12 mx-auto mb-4 text-eco-primary" />
                  <h3 className="font-semibold mb-2">Single Item</h3>
                  <p className="text-sm text-muted-foreground">Scan individual product</p>
                </Card>
              </div>
            </div>

            {/* Camera Interface */}
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
                    {isScanning ? "Analyzing..." : `Ready to scan ${scanMode}`}
                  </h3>
                  <p className="text-muted-foreground">
                    {isScanning 
                      ? "Processing image and calculating carbon footprint..."
                      : `Position your ${scanMode} in the camera view and tap to scan`
                    }
                  </p>
                </div>

                <div className="space-y-3">
                  <Button 
                    onClick={scanMode === "receipt" ? mockScanReceipt : mockScanItem}
                    disabled={isScanning}
                    size="lg" 
                    className="w-full bg-gradient-eco hover:opacity-90"
                  >
                    {isScanning ? (
                      <>
                        <Scan className="mr-2 h-5 w-5 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-5 w-5" />
                        Capture {scanMode === "receipt" ? "Receipt" : "Item"}
                      </>
                    )}
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload from Gallery
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

            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                onClick={() => {setScanResult(null); setIsScanning(false);}}
              >
                Scan Another
              </Button>
              <Link to="/dashboard">
                <Button className="w-full bg-gradient-eco hover:opacity-90">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScannerPage;