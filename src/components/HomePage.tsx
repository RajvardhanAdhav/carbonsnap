import { useState } from "react";
import { Camera, Scan, BarChart3, Leaf, ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "./AuthModal";
import { TestOpenAI } from "./TestOpenAI";

const HomePage = () => {
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const features = [
    {
      icon: Camera,
      title: "Smart Receipt Scanner",
      description: "AI-powered receipt analysis for instant carbon footprint calculations",
      href: "/scanner"
    },
    {
      icon: Scan,
      title: "Product Scanner",
      description: "Scan any product to understand its environmental impact",
      href: "/scanner"
    },
    {
      icon: BarChart3,
      title: "Impact Dashboard",
      description: "Track your progress with detailed analytics and insights",
      href: "/dashboard"
    }
  ];

  const stats = [
    { value: "2.5kg", label: "CO₂ Saved This Week", color: "text-emerald-600" },
    { value: "150+", label: "Items Analyzed", color: "text-blue-600" },
    { value: "89%", label: "Goal Progress", color: "text-purple-600" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Clean Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-eco rounded-lg flex items-center justify-center">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-lg">Carbon Snap</span>
          </div>
          
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
                <Link to="/scanner">
                  <Button variant="ghost" size="sm">Scanner</Button>
                </Link>
                <Button 
                  onClick={signOut}
                  variant="outline" 
                  size="sm"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => setShowAuthModal(true)}
                variant="clean"
                size="sm"
              >
                Get Started
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-4 py-20 lg:py-32">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Leaf className="h-3 w-3" />
              Track your environmental impact
            </p>
            
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
              Know Your Carbon
              <span className="block text-eco-primary">Footprint</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Scan receipts and products to instantly understand your environmental impact. 
              Get personalized insights to reduce your carbon footprint.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              {user ? (
                <div className="flex gap-3">
                  <Link to="/scanner">
                    <Button size="lg" variant="clean" className="h-11 px-6">
                      <Camera className="mr-2 h-4 w-4" />
                      Start Scanning
                    </Button>
                  </Link>
                  <Link to="/dashboard">
                    <Button variant="subtle" size="lg" className="h-11 px-6">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View Dashboard
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button 
                    onClick={() => setShowAuthModal(true)}
                    variant="clean"
                    size="lg" 
                    className="h-11 px-6"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button 
                    variant="subtle" 
                    size="lg" 
                    className="h-11 px-6"
                    onClick={() => {
                      document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    See Demo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {user && (
        <section className="px-4 py-16">
          <div className="container mx-auto max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.map((stat, index) => (
                <Card key={index} className="border-0 shadow-soft">
                  <CardContent className="p-6 text-center">
                    <div className={`text-3xl font-bold ${stat.color}`}>
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {stat.label}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section id="demo" className="px-4 py-20 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Simple. Powerful. Sustainable.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to understand and reduce your environmental impact
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-eco transition-all duration-300 border-0 bg-background">
                <CardContent className="p-8">
                  <div className="mb-6">
                    <div className="w-12 h-12 bg-gradient-eco rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                  
                  {user && (
                    <Link to={feature.href}>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Try it now
                        <ArrowRight className="ml-2 h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="px-4 py-20">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="bg-foreground rounded-2xl p-12 text-background">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Ready to make a difference?
              </h2>
              <p className="text-lg opacity-80 mb-8 max-w-2xl mx-auto">
                Join thousands of users already tracking and reducing their carbon footprint.
                Start your sustainable journey today.
              </p>
              <Button 
                onClick={() => setShowAuthModal(true)}
                size="lg"
                variant="outline"
                className="h-11 px-6 border-background text-background hover:bg-background hover:text-foreground"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="px-4 py-12 border-t border-border/40">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-6 h-6 bg-gradient-eco rounded-lg flex items-center justify-center">
                <Leaf className="h-3 w-3 text-white" />
              </div>
              <span className="font-semibold">Carbon Snap</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Made with 💚 for a sustainable future
            </p>
          </div>
        </div>
      </footer>

      {/* OpenAI API Test Section - Development Only */}
      {process.env.NODE_ENV === 'development' && (
        <section className="px-4 py-8 bg-muted/30">
          <div className="container mx-auto max-w-md">
            <TestOpenAI />
          </div>
        </section>
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default HomePage;