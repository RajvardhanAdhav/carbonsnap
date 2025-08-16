import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  success: boolean;
  status?: number;
  apiResponse?: string;
  usage?: any;
  error?: string;
  timestamp: string;
}

export const TestOpenAI = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const { toast } = useToast();

  const testOpenAI = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      console.log('🧪 Testing OpenAI API...');
      
      const { data, error } = await supabase.functions.invoke('test-openai-api', {
        body: {}
      });
      
      if (error) {
        throw error;
      }
      
      setResult(data);
      
      if (data.success) {
        toast({
          title: "OpenAI API Working! ✅",
          description: `Response: ${data.apiResponse}`,
        });
      } else {
        toast({
          title: "OpenAI API Failed ❌",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Test failed:', error);
      const errorResult: TestResult = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      setResult(errorResult);
      
      toast({
        title: "Test Failed ❌",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>OpenAI API Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testOpenAI} 
          disabled={testing}
          className="w-full"
        >
          {testing ? 'Testing...' : 'Test OpenAI API'}
        </Button>
        
        {result && (
          <div className="p-3 rounded-lg bg-muted">
            <div className="text-sm space-y-1">
              <div className="font-medium">
                Status: {result.success ? '✅ Success' : '❌ Failed'}
              </div>
              {result.status && (
                <div>HTTP Status: {result.status}</div>
              )}
              {result.apiResponse && (
                <div>API Response: "{result.apiResponse}"</div>
              )}
              {result.usage && (
                <div>Tokens Used: {result.usage.total_tokens}</div>
              )}
              {result.error && (
                <div className="text-destructive">Error: {result.error}</div>
              )}
              <div className="text-xs text-muted-foreground">
                {new Date(result.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};