import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Receipt, Package } from 'lucide-react';

interface ManualInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

interface ReceiptItem {
  name: string;
  quantity: string;
  price: string;
  category: string;
}

export default function ManualInputModal({ isOpen, onClose, onSubmit, isLoading }: ManualInputModalProps) {
  const [inputType, setInputType] = useState<'receipt' | 'item'>('receipt');
  
  // Receipt form state
  const [receiptData, setReceiptData] = useState({
    store: '',
    date: new Date().toISOString().split('T')[0],
    items: [{ name: '', quantity: '', price: '', category: 'food' }] as ReceiptItem[]
  });

  // Single item form state
  const [itemData, setItemData] = useState({
    name: '',
    brand: '',
    category: 'general',
    description: ''
  });

  const addReceiptItem = () => {
    setReceiptData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: '', price: '', category: 'food' }]
    }));
  };

  const removeReceiptItem = (index: number) => {
    setReceiptData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateReceiptItem = (index: number, field: keyof ReceiptItem, value: string) => {
    setReceiptData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSubmit = () => {
    if (inputType === 'receipt') {
      // Convert receipt data to expected format
      const processedItems = receiptData.items
        .filter(item => item.name.trim())
        .map(item => ({
          name: item.name,
          quantity: item.quantity || '1',
          price: parseFloat(item.price) || 0,
          category: item.category
        }));

      if (processedItems.length === 0) {
        return; // Don't submit empty receipts
      }

      onSubmit({
        type: 'receipt',
        store: receiptData.store,
        date: receiptData.date,
        items: processedItems,
        scanMethod: 'manual'
      });
    } else {
      if (!itemData.name.trim()) {
        return; // Don't submit without item name
      }

      onSubmit({
        type: 'single_item',
        productName: itemData.name,
        brand: itemData.brand,
        category: itemData.category,
        description: itemData.description,
        scanMethod: 'manual'
      });
    }
  };

  const resetForms = () => {
    setReceiptData({
      store: '',
      date: new Date().toISOString().split('T')[0],
      items: [{ name: '', quantity: '', price: '', category: 'food' }]
    });
    setItemData({
      name: '',
      brand: '',
      category: 'general',
      description: ''
    });
  };

  const handleClose = () => {
    resetForms();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Manual Input</DialogTitle>
        </DialogHeader>

        <Tabs value={inputType} onValueChange={(value) => setInputType(value as 'receipt' | 'item')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="receipt" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Receipt
            </TabsTrigger>
            <TabsTrigger value="item" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Single Item
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receipt" className="space-y-4">
            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="store">Store Name</Label>
                  <Input
                    id="store"
                    placeholder="e.g., Green Market"
                    value={receiptData.store}
                    onChange={(e) => setReceiptData(prev => ({ ...prev, store: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={receiptData.date}
                    onChange={(e) => setReceiptData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Items</Label>
                  <Button type="button" onClick={addReceiptItem} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                
                {receiptData.items.map((item, index) => (
                  <Card key={index} className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Item {index + 1}</span>
                      {receiptData.items.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => removeReceiptItem(index)}
                          size="sm"
                          variant="outline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Input
                          placeholder="Product name"
                          value={item.name}
                          onChange={(e) => updateReceiptItem(index, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="Quantity (e.g., 2 lbs)"
                          value={item.quantity}
                          onChange={(e) => updateReceiptItem(index, 'quantity', e.target.value)}
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price ($)"
                          value={item.price}
                          onChange={(e) => updateReceiptItem(index, 'price', e.target.value)}
                        />
                      </div>
                      <div>
                        <Select
                          value={item.category}
                          onValueChange={(value) => updateReceiptItem(index, 'category', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="food">Food</SelectItem>
                            <SelectItem value="clothing">Clothing</SelectItem>
                            <SelectItem value="electronics">Electronics</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="item" className="space-y-4">
            <Card className="p-4 space-y-4">
              <div>
                <Label htmlFor="item-name">Product Name *</Label>
                <Input
                  id="item-name"
                  placeholder="e.g., Organic Cotton T-Shirt"
                  value={itemData.name}
                  onChange={(e) => setItemData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  placeholder="e.g., EcoWear"
                  value={itemData.brand}
                  onChange={(e) => setItemData(prev => ({ ...prev, brand: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={itemData.category}
                  onValueChange={(value) => setItemData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clothing">Clothing</SelectItem>
                    <SelectItem value="electronics">Electronics</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Additional details about the product..."
                  value={itemData.description}
                  onChange={(e) => setItemData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className="flex-1 bg-gradient-eco"
          >
            {isLoading ? 'Processing...' : 'Add Item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}