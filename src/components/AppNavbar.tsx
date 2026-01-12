"use client";

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Menu, Home, Calendar, Users, Settings, LogOut, UserCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const AppNavbar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [userName, setUserName] = useState('Guest');
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .single();

        if (profile && profile.first_name) {
          setUserName(profile.first_name);
        } else if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
      }
    };

    fetchUserProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserProfile();
      } else {
        setUserName('Guest');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
      navigate('/login');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Logout Failed',
        description: error.message,
      });
    }
  };

  const navLinks = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/all-appointments', icon: Calendar, label: 'All Appointments' },
    { to: '/all-clients', icon: Users, label: 'All Clients' },
  ];

  const renderNavLinks = (onLinkClick?: () => void) => (
    <nav className="flex flex-col lg:flex-row lg:items-center lg:space-x-4 space-y-2 lg:space-y-0">
      {navLinks.map((link) => (
        <Button
          key={link.to}
          asChild
          variant="ghost"
          className="w-full lg:w-auto justify-start lg:justify-center text-lg lg:text-base text-indigo-800 hover:bg-indigo-100 hover:text-indigo-900"
          onClick={onLinkClick}
        >
          <Link to={link.to}>
            <link.icon className="mr-3 lg:mr-2 h-5 w-5" />
            {link.label}
          </Link>
        </Button>
      ))}
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo/App Title */}
        <Link to="/" className="flex items-center space-x-2 text-xl font-bold text-indigo-700 hover:text-indigo-900">
          <img src="/public/favicon.ico" alt="Logo" className="h-7 w-7" />
          <span>Kinesiology App</span>
        </Link>

        {/* Desktop Navigation */}
        {!isMobile && (
          <div className="flex items-center space-x-6">
            {renderNavLinks()}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <UserCircle2 className="h-6 w-6 text-indigo-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Hi, {userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {/* User email could go here if needed */}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile-setup')}>
                  <UserCircle2 className="mr-2 h-4 w-4" />
                  Profile Setup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/notion-config')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Notion Config
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Mobile Navigation */}
        {isMobile && (
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6 text-indigo-600" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[250px] sm:w-[300px] p-4">
              <div className="flex flex-col space-y-6 pt-6">
                <Link to="/" className="flex items-center space-x-2 text-xl font-bold text-indigo-700" onClick={() => setIsSheetOpen(false)}>
                  <img src="/public/favicon.ico" alt="Logo" className="h-7 w-7" />
                  <span>Kinesiology App</span>
                </Link>
                <div className="flex flex-col space-y-2">
                  {renderNavLinks(() => setIsSheetOpen(false))}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start text-lg text-indigo-800 hover:bg-indigo-100 hover:text-indigo-900">
                        <UserCircle2 className="mr-3 h-5 w-5" />
                        User Menu
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full" align="start" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">Hi, {userName}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { navigate('/profile-setup'); setIsSheetOpen(false); }}>
                        <UserCircle2 className="mr-2 h-4 w-4" />
                        Profile Setup
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { navigate('/notion-config'); setIsSheetOpen(false); }}>
                        <Settings className="mr-2 h-4 w-4" />
                        Notion Config
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </header>
  );
};

export default AppNavbar;