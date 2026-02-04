import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { motion } from 'motion/react';
import { UserProfile } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { User, BookOpen, Sparkles, TrendingUp, Trophy, MessageSquare, HelpCircle, Menu, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';

interface HeaderProps {
  profile?: UserProfile;
  isAuthenticated?: boolean;
}

export function Header({ profile, isAuthenticated = false }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isAuthenticated && supabase) {
      const loadEmail = async () => {
        const { data } = await supabase.auth.getUser();
        setUserEmail(data?.user?.email ?? '');
      };
      loadEmail();
    }
  }, [isAuthenticated]);

  const activeKey = location.pathname.startsWith('/subjects')
    ? 'subjects'
    : location.pathname.startsWith('/progress')
    ? 'progress'
    : location.pathname.startsWith('/achievements')
    ? 'achievements'
    : location.pathname.startsWith('/messages')
    ? 'messages'
    : location.pathname.startsWith('/dashboard')
    ? 'dashboard'
    : '';

  const isHomePage = location.pathname === '/';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-transparent pointer-events-none w-full overflow-hidden">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-2 sm:pt-4 w-full">
        <motion.header
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`pointer-events-auto rounded-2xl sm:rounded-3xl bg-white px-3 sm:px-6 py-3 sm:py-4 shadow-xl ring-1 ring-slate-200 transition-all duration-300 w-full ${
            isScrolled ? 'shadow-2xl' : ''
          }`}
        >
          <div className="flex items-center justify-between w-full min-w-0">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer flex-shrink-0"
              onClick={() => navigate('/')}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-600 text-white flex items-center justify-center font-semibold text-sm sm:text-base">
                TP
              </div>
              <div className="hidden sm:block">
                <span className="text-base sm:text-lg font-semibold text-slate-900">Tutor Prep</span>
                {profile && (
                  <p className="text-xs text-gray-500">
                    {profile.curriculum} • Grade {profile.grade}
                  </p>
                )}
              </div>
              <div className="sm:hidden">
                <span className="text-sm font-semibold text-slate-900">Tutor Prep</span>
              </div>
            </motion.div>

            {/* Navigation menu for authenticated users - integrated into header */}
            {isAuthenticated && profile ? (
              <>
                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center justify-between flex-1 mx-4 lg:mx-8 min-w-0">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/dashboard')}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                      activeKey === 'dashboard' ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                    <span className="text-xs font-medium">Dashboard</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/subjects')}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                      activeKey === 'subjects' ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                    <span className="text-xs">Learn</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/progress')}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                      activeKey === 'progress' ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-xs">Progress</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/achievements')}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                      activeKey === 'achievements' ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <Trophy className="w-5 h-5" />
                    <span className="text-xs">Awards</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/messages')}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                      activeKey === 'messages' ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-xs">Support</span>
                  </motion.button>
                </div>

                {/* Mobile Navigation */}
                <div className="md:hidden flex items-center gap-2">
                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                      >
                        <Menu className="w-5 h-5 text-gray-700" />
                      </motion.button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[85vw] sm:w-80">
                      <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                      <SheetDescription className="sr-only">Main navigation menu for Tutor Prep</SheetDescription>
                      <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-xl font-semibold">Menu</h2>
                          <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <nav className="flex-1 space-y-2">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              navigate('/dashboard');
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                              activeKey === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <BookOpen className="w-5 h-5" />
                            <span className="font-medium">Dashboard</span>
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              navigate('/subjects');
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                              activeKey === 'subjects' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Sparkles className="w-5 h-5" />
                            <span className="font-medium">Learn</span>
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              navigate('/progress');
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                              activeKey === 'progress' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <TrendingUp className="w-5 h-5" />
                            <span className="font-medium">Progress</span>
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              navigate('/achievements');
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                              activeKey === 'achievements' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Trophy className="w-5 h-5" />
                            <span className="font-medium">Awards</span>
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              navigate('/messages');
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                              activeKey === 'messages' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <MessageSquare className="w-5 h-5" />
                            <span className="font-medium">Support</span>
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              navigate('/help');
                              setMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left text-gray-700 hover:bg-gray-50"
                          >
                            <HelpCircle className="w-5 h-5" />
                            <span className="font-medium">Help</span>
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              navigate('/profile');
                              setMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left text-gray-700 hover:bg-gray-50"
                          >
                            <User className="w-5 h-5" />
                            <span className="font-medium">Profile</span>
                          </motion.button>
                        </nav>
                        <div className="pt-4 border-t">
                          <div className="px-4 py-2 mb-2">
                            <p className="text-sm font-semibold text-gray-900">{profile.name}</p>
                            {userEmail && <p className="text-xs text-gray-500">{userEmail}</p>}
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={async () => {
                              if (supabase) {
                                await supabase.auth.signOut();
                                navigate('/');
                              }
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                          >
                            Sign out
                          </motion.button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg"
                    >
                      <User className="w-5 h-5 text-white" />
                    </motion.button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{profile.name}</span>
                        {userEmail && <span className="text-xs text-muted-foreground">{userEmail}</span>}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      Update profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/help')}>
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Help & Documentation
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={async () => {
                        if (supabase) {
                          await supabase.auth.signOut();
                          navigate('/');
                        }
                      }}
                    >
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </>
            ) : (
              <>
                {/* Desktop Navigation */}
                <nav className="hidden items-center gap-6 lg:gap-8 text-sm font-medium text-slate-600 md:flex flex-1 justify-center">
                  <a
                    href="#home"
                    className={isHomePage ? 'text-slate-900 font-semibold' : 'hover:text-slate-900 transition-colors'}
                    onClick={(e) => {
                      e.preventDefault();
                      if (isHomePage) {
                        document.getElementById('home')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      } else {
                        navigate('/');
                        setTimeout(() => {
                          document.getElementById('home')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }
                    }}
                  >
                    Home
                  </a>
                  <a
                    href="#products"
                    className="hover:text-slate-900 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      if (isHomePage) {
                        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      } else {
                        navigate('/');
                        setTimeout(() => {
                          document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }
                    }}
                  >
                    Products
                  </a>
                  <a
                    href="#about"
                    className="hover:text-slate-900 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      if (isHomePage) {
                        document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      } else {
                        navigate('/');
                        setTimeout(() => {
                          document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }
                    }}
                  >
                    About
                  </a>
                  <a
                    href="#pricing"
                    className="hover:text-slate-900 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      if (isHomePage) {
                        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      } else {
                        navigate('/');
                        setTimeout(() => {
                          document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }
                    }}
                  >
                    Pricing
                  </a>
                </nav>
                {/* Desktop Buttons */}
                <div className="hidden md:flex items-center gap-2 lg:gap-3 ml-4 lg:ml-8">
                  <Button asChild variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 text-xs lg:text-sm">
                    <Link to="/parent-portal/login">Parent Portal</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 text-xs lg:text-sm">
                    <Link to="/login">Log in</Link>
                  </Button>
                  <Button asChild size="sm" className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-4 lg:px-6 text-xs lg:text-sm">
                    <Link to="/signup">Get started</Link>
                  </Button>
                </div>
                {/* Mobile Menu Button */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                    >
                      <Menu className="w-5 h-5 text-gray-700" />
                    </motion.button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-80">
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                    <SheetDescription className="sr-only">Main navigation menu for Tutor Prep</SheetDescription>
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold">Menu</h2>
                        <button
                          onClick={() => setMobileMenuOpen(false)}
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <nav className="flex-1 space-y-2">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            navigate('/');
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left text-gray-700 hover:bg-gray-50"
                        >
                          <span className="font-medium">Home</span>
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            navigate('/#products');
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left text-gray-700 hover:bg-gray-50"
                        >
                          <span className="font-medium">Products</span>
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            navigate('/#about');
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left text-gray-700 hover:bg-gray-50"
                        >
                          <span className="font-medium">About</span>
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            navigate('/#pricing');
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left text-gray-700 hover:bg-gray-50"
                        >
                          <span className="font-medium">Pricing</span>
                        </motion.button>
                      </nav>
                      <div className="pt-4 border-t space-y-2">
                        <Button asChild variant="outline" className="w-full">
                          <Link to="/parent-portal/login" onClick={() => setMobileMenuOpen(false)}>Parent Portal</Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full">
                          <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
                        </Button>
                        <Button asChild className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white">
                          <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>Get started</Link>
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            )}
          </div>
        </motion.header>
      </div>
    </div>
  );
}
