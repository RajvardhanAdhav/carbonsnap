import { useState } from "react";
import { Camera, Scan, BarChart3, Leaf, Zap, Target, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "./AuthModal";
import heroImage from "@/assets/carbon-snap-hero.jpg";

const HomePage = () => {
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const features = [
    {
      icon: Camera,
      title: "Receipt Scanner",
      description: "Snap photos of receipts to instantly calculate carbon footprint",
      color: "eco-primary"
    },
    {
      icon: Scan,
      title: "Item Scanner",
      description: "Scan individual products with barcode or image recognition",
      color: "eco-secondary"
    },
    {
      icon: BarChart3,
      title: "Carbon Analytics",
      description: "Track your emissions over time with detailed insights",
      color: "accent"
    }
  ];

  const stats = [
    { value: "2.5kg", label: "CO₂ Saved This Week" },
    { value: "150+", label: "Items Scanned" },
    { value: "89%", label: "Carbon Reduction Goal" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-eco-light">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 text-eco-primary">
            <Leaf className="h-6 w-6" />
            <span className="font-semibold">Carbon Snap</span>
          </div>
          
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {user.user_metadata?.full_name || user.email}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAuthModal(true)}>
              <User className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-16 lg:py-24 pt-24">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center gap-2 text-eco-primary">
                <Leaf className="h-6 w-6" />
                <span className="font-semibold">Carbon Snap</span>
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                Track Your
                <span className="text-transparent bg-gradient-eco bg-clip-text block">
                  Carbon Footprint
                </span>
                Effortlessly
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-lg">
                Scan receipts and items to understand your environmental impact. 
                Get personalized insights and tips to reduce your carbon footprint.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                {user ? (
                  <>
                    <Link to="/scanner">
                      <Button size="lg" className="w-full sm:w-auto bg-gradient-eco hover:opacity-90 shadow-eco">
                        <Camera className="mr-2 h-5 w-5" />
                        Start Scanning
                      </Button>
                    </Link>
                    <Link to="/dashboard">
                      <Button variant="outline" size="lg" className="w-full sm:w-auto">
                        <BarChart3 className="mr-2 h-5 w-5" />
                        View Dashboard
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Button 
                      size="lg" 
                      className="w-full sm:w-auto bg-gradient-eco hover:opacity-90 shadow-eco"
                      onClick={() => setShowAuthModal(true)}
                    >
                      <Camera className="mr-2 h-5 w-5" />
                      Get Started
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="w-full sm:w-auto"
                      onClick={() => setShowAuthModal(true)}
                    >
                      <BarChart3 className="mr-2 h-5 w-5" />
                      Learn More
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <div className="relative animate-scale-in">
              <img 
                src={heroImage} 
                alt="Carbon Snap App Interface" 
                className="rounded-2xl shadow-eco max-w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="p-6 text-center bg-card/50 backdrop-blur-sm border-0 shadow-soft">
                <div className="text-3xl font-bold text-eco-primary mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">How Carbon Snap Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to understand and reduce your environmental impact
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-8 text-center border-0 shadow-soft hover:shadow-eco transition-all duration-300 group hover:-translate-y-2">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-${feature.color}/10 mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`h-8 w-8 text-${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold mb-4">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 bg-gradient-eco">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="space-y-6 text-white">
            <div className="flex justify-center items-center gap-2 mb-4">
              <Target className="h-8 w-8" />
              <Zap className="h-8 w-8" />
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold">Ready to Make a Difference?</h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Join thousands of users reducing their carbon footprint one scan at a time
            </p>
            {user ? (
              <Link to="/scanner">
                <Button size="lg" variant="secondary" className="bg-white text-eco-primary hover:bg-white/90">
                  <Camera className="mr-2 h-5 w-5" />
                  Start Your Journey
                </Button>
              </Link>
            ) : (
              <Button 
                size="lg" 
                variant="secondary" 
                className="bg-white text-eco-primary hover:bg-white/90"
                onClick={() => setShowAuthModal(true)}
              >
                <Camera className="mr-2 h-5 w-5" />
                Start Your Journey
              </Button>
            )}
          </div>
        </div>
      </section>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default HomePage;