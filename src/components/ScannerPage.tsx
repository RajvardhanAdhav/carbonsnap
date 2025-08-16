import { useState } from "react";
import { Camera, Upload, Scan, Receipt, ArrowLeft, CheckCircle, Edit, Loader2, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('groq_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(() => !localStorage.getItem('groq_api_key'));

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('groq_api_key', apiKey.trim());
      setShowApiKeyInput(false);
      setError(null);
    } else {
      setError('Please enter a valid API key');
    }
  };

  const processImage = async (imageData: string, scanMethod: string = 'camera') => {
    console.log('ProcessImage called with scanMethod:', scanMethod, 'imageData length:', imageData.length);
    if (!user) {
      setError('User not authenticated');
      return;
    }

    const savedApiKey = localStorage.getItem('groq_api_key');
    if (!savedApiKey) {
      setError('Please enter your Groq API key first');
      setShowApiKeyInput(true);
      return;
    }

    setIsScanning(true);
    setError(null);
    
    try {
      if (scanMode === 'receipt') {
        console.log('Sending receipt to Groq API...');
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${savedApiKey}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: 'Analyze receipt images and extract all items with their carbon footprint. Return a JSON object with: store name, date, items array (each item should have name, quantity, carbon footprint in kg CO2e, and category: low/medium/high), and total carbon footprint. Estimate carbon footprints based on product type and typical values.'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Please analyze this receipt and provide the carbon footprint data in JSON format'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageData
                    }
                  }
                ]
              }
            ],
            model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
            temperature: 1,
            max_completion_tokens: 1024,
            top_p: 1,
            stream: false,
            response_format: {
              type: 'json_object'
            },
            stop: null
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);
        
        setScanResult({ 
          type: 'receipt', 
          store: result.store || 'Unknown Store',
          date: result.date || new Date().toLocaleDateString(),
          items: result.items || [],
          totalCarbon: result.totalCarbon || 0
        });
      }
    } catch (error) {
      console.error('Error processing image:', error);
      setError(`Receipt Processing Failed - ${error.message || 'Please try a clearer image or manual input'}`);
    } finally {
      setIsScanning(false);
      setShowCamera(false);
    }
  };

  const handleManualSubmit = async (data: any) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    const savedApiKey = localStorage.getItem('groq_api_key');
    if (!savedApiKey) {
      setError('Please enter your Groq API key first');
      setShowApiKeyInput(true);
      return;
    }

    setIsScanning(true);
    setError(null);
    
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${savedApiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'Analyze manual receipt data and calculate carbon footprints. Return a JSON object with: store name, date, items array (each item should have name, quantity, carbon footprint in kg CO2e, and category: low/medium/high), and total carbon footprint. Estimate carbon footprints based on product type and typical values.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Please analyze this manual receipt data: ${JSON.stringify(data)}`
                }
              ]
            }
          ],
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
          temperature: 1,
          max_completion_tokens: 1024,
          top_p: 1,
          stream: false,
          response_format: {
            type: 'json_object'
          },
          stop: null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
      }

      const result = await response.json();
      const parsedResult = JSON.parse(result.choices[0].message.content);
      
      setScanResult({ 
        type: 'receipt', 
        store: parsedResult.store || 'Manual Input',
        date: parsedResult.date || new Date().toLocaleDateString(),
        items: parsedResult.items || [],
        totalCarbon: parsedResult.totalCarbon || 0
      });
    } catch (error) {
      console.error('Error processing manual input:', error);
      setError(`Manual Input Processing Failed - ${error.message || 'Please try again.'}`);
    } finally {
      setIsScanning(false);
      setShowManualInput(false);
    }
  };

  const handleBarcodeDetected = async (barcode: string, productData?: any) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    const savedApiKey = localStorage.getItem('groq_api_key');
    if (!savedApiKey) {
      setError('Please enter your Groq API key first');
      setShowApiKeyInput(true);
      return;
    }

    setIsScanning(true);
    setShowBarcodeScanner(false);
    setError(null);
    
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${savedApiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'Analyze barcode data and provide product information with carbon footprint. Return a JSON object with: name, brand, carbon footprint in kg CO2e, category (low/medium/high), and details object containing material, origin, transport, and packaging information. Use typical values for common products.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Please analyze this barcode: ${barcode} and provide product information`
                }
              ]
            }
          ],
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
          temperature: 1,
          max_completion_tokens: 1024,
          top_p: 1,
          stream: false,
          response_format: {
            type: 'json_object'
          },
          stop: null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
      }

      const result = await response.json();
      const parsedResult = JSON.parse(result.choices[0].message.content);
      
      setScanResult({ 
        type: 'item', 
        name: parsedResult.name || 'Unknown Product',
        brand: parsedResult.brand || 'Unknown Brand',
        carbon: parsedResult.carbon || 0,
        category: parsedResult.category || 'medium',
        details: parsedResult.details || {
          material: 'Unknown',
          origin: 'Unknown',
          transport: 'Unknown',
          packaging: 'Unknown'
        }
      });
    } catch (error) {
      console.error('Error processing barcode:', error);
      setError(`Barcode Processing Failed - ${error.message || 'Please try again.'}`);
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
          <div className="ml-auto">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* API Key Input */}
      {showApiKeyInput && (
        <div className="border-b bg-muted/30 p-4">
          <div className="container mx-auto max-w-2xl">
            <div className="space-y-3">
              <h3 className="font-medium">Groq API Key</h3>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Enter your Groq API key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={saveApiKey} size="sm">
                  Save
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Your API key will be stored locally in your browser. Get your key from{" "}
                <a href="https://groq.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  groq.com
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

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

            {/* Error Display */}
            {error && (
              <Card className="p-4 mb-6 bg-destructive/10 border-destructive">
                <p className="text-destructive text-center font-medium">{error}</p>
              </Card>
            )}

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