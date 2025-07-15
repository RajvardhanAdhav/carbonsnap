import { useState } from "react";
import { ArrowLeft, Moon, Sun, Bell, Shield, HelpCircle, Info, User, Trash2, LogOut, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { ProductivityTracker } from "@/components/ProductivityTracker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [autoScan, setAutoScan] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const isDark = theme === "dark";

  const handleSignOut = async () => {
    await signOut();
  };

  const handleClearAllData = async () => {
    if (!user) return;
    
    if (!confirm("Are you sure you want to delete all your scanned items and history? This action cannot be undone.")) {
      return;
    }

    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('scanned_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Data Cleared",
        description: "All your scanning history has been deleted.",
      });
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: "Error",
        description: "Failed to clear data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  const settingsSections = [
    {
      title: "Appearance",
      items: [
        {
          icon: isDark ? Moon : Sun,
          label: "Dark Mode",
          description: "Switch between light and dark theme",
          control: (
            <Switch
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          )
        }
      ]
    },
    {
      title: "Notifications",
      items: [
        {
          icon: Bell,
          label: "Push Notifications",
          description: "Get notified about your carbon goals",
          control: (
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          )
        }
      ]
    },
    {
      title: "Scanning",
      items: [
        {
          icon: Shield,
          label: "Auto-scan on Camera Open",
          description: "Automatically scan when camera detects items",
          control: (
            <Switch
              checked={autoScan}
              onCheckedChange={setAutoScan}
            />
          )
        }
      ]
    }
  ];

  const accountActions = [
    {
      icon: User,
      label: "Account Info",
      description: user?.email || "Not signed in",
      action: () => console.log("Account info"),
      variant: "default" as const
    },
    {
      icon: HelpCircle,
      label: "Help & Support",
      description: "Get help and contact support",
      action: () => console.log("Help"),
      variant: "default" as const
    },
    {
      icon: Info,
      label: "About Carbon Snap",
      description: "Version 1.0.0",
      action: () => console.log("About"),
      variant: "default" as const
    },
    {
      icon: Trash2,
      label: "Clear All Data",
      description: "Delete all scanned items and history",
      action: handleClearAllData,
      variant: "destructive" as const
    },
    {
      icon: LogOut,
      label: "Sign Out",
      description: "Sign out of your account",
      action: handleSignOut,
      variant: "destructive" as const
    }
  ];

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
          <h1 className="font-semibold">Settings</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* User Info */}
        {user && (
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-eco-primary rounded-full flex items-center justify-center text-white font-semibold text-lg">
                {user.user_metadata?.full_name?.[0] || user.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="font-semibold">{user.user_metadata?.full_name || "User"}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs for Settings and Productivity */}
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="productivity" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Progress
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            {/* Settings Sections */}
            {settingsSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{section.title}</h3>
                <Card className="divide-y">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      {item.control}
                    </div>
                  ))}
                </Card>
              </div>
            ))}

            <Separator className="my-6" />

            {/* Account Actions */}
            <div className="space-y-2">
              {accountActions.map((action, index) => (
                <Card key={index} className="p-0 overflow-hidden">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start p-4 h-auto ${
                      action.variant === 'destructive' ? 'text-destructive hover:text-destructive hover:bg-destructive/10' : ''
                    }`}
                    onClick={action.action}
                    disabled={action.label === "Clear All Data" && isClearing}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className={`p-2 rounded-lg ${
                        action.variant === 'destructive' ? 'bg-destructive/10' : 'bg-muted'
                      }`}>
                        <action.icon className={`h-4 w-4 ${
                          action.variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">
                          {action.label === "Clear All Data" && isClearing ? "Clearing..." : action.label}
                        </p>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                    </div>
                  </Button>
                </Card>
              ))}
            </div>

            {/* App Info */}
            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>Carbon Snap v1.0.0</p>
              <p>Made with 💚 for a sustainable future</p>
            </div>
          </TabsContent>

          <TabsContent value="productivity">
            <ProductivityTracker />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;