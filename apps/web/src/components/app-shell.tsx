'use client';

import { useState, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  LayoutDashboard, FolderOpen, FileText, BookTemplate,
  LogOut, Menu, X, ChevronRight, User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UserData {
  id: string;
  email: string;
  name: string | null;
}

const AuthContext = createContext<{ user: UserData | null; loading: boolean }>({
  user: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/templates', label: 'Templates', icon: BookTemplate },
];

export function AppShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: UserData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user] = useState<UserData | null>(initialUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (!user) return null;

  return (
    <AuthContext.Provider value={{ user, loading: false }}>
      <div className="min-h-screen flex">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-brand-primary text-white flex flex-col transition-transform duration-300 lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="p-5 flex items-center justify-between border-b border-white/10">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image src="/brand/damac-logo-white.svg" alt="DAMAC" width={120} height={16} className="h-4 w-auto" />
              <span className="text-white/60 text-sm font-light">DocGen</span>
            </Link>
            <button
              className="lg:hidden text-white/70 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  {item.label}
                  {active && <ChevronRight className="h-4 w-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3 px-3">
              <div className="w-8 h-8 rounded-full bg-brand-accent/30 flex items-center justify-center">
                <UserIcon className="h-4 w-4 text-brand-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name || 'User'}</p>
                <p className="text-xs text-white/50 truncate">{user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-16 border-b bg-white flex items-center px-4 lg:px-8 gap-4 sticky top-0 z-30">
            <button
              className="lg:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{user.email}</span>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
