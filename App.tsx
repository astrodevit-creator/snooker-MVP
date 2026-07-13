
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UserProvider } from './contexts/UserContext';
import { BusinessDayProvider } from './contexts/BusinessDayContext';
import { useAuth } from './hooks/useAuth';
import { useGames } from './hooks/useGames';
import { useUsers } from './hooks/useUsers';
import { useBusinessDay } from './hooks/useBusinessDay';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import Header from './components/Header';
import { Role } from './types';
import ProtectedRoute from './components/ProtectedRoute';
import { AlertTriangle, LoaderCircle } from './components/icons';
import { Button } from './components/ui/Button';
import NotificationWatcher from './components/NotificationWatcher';

const SetupWarning: React.FC = () => {
    const { isTableMissing: gamesMissing, refetchGames, isLoading, error } = useGames();
    const { isTableMissing: usersMissing } = useUsers();
    const { isTableMissing: configMissing } = useBusinessDay();
    
    const isAnyTableMissing = gamesMissing || usersMissing || configMissing;
    
    if (!isAnyTableMissing && !error) return null;
    
    return (
        <div className="bg-destructive text-destructive-foreground px-4 py-3 text-center text-sm font-bold flex flex-col gap-2 justify-center shadow-lg z-[60] relative">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>
                        {isAnyTableMissing 
                            ? "Database Tables Not Found! Did you run the SQL script in Supabase?" 
                            : "Supabase Database Connection Issue Detected!"}
                    </span>
                </div>
                <div className="flex gap-2">
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 text-xs bg-white text-destructive hover:bg-white/90"
                        onClick={() => window.location.reload()}
                    >
                        Refresh Page
                    </Button>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-xs border-white text-white hover:bg-white/10"
                        onClick={() => refetchGames()}
                        disabled={isLoading}
                    >
                        {isLoading ? <LoaderCircle className="h-3 w-3 animate-spin mr-1" /> : null}
                        Re-Verify Connection
                    </Button>
                </div>
            </div>
            {error && (
                <div className="text-[11px] font-mono bg-black/20 p-1.5 rounded text-red-200 mt-1 max-w-3xl mx-auto break-all">
                    Detail: {error}
                </div>
            )}
        </div>
    );
};

const AppRoutes: React.FC = () => {
    const { user, logout } = useAuth();
    const { users, isLoading: usersLoading } = useUsers();

    // Session Validation: Check if the logged-in user still exists in the DB.
    useEffect(() => {
        if (!usersLoading && user && users.length > 0) {
            const stillExists = users.some(u => u.id === user.id);
            if (!stillExists) {
                console.warn("Current session user ID not found in database. Forcing logout to prevent database errors.");
                logout();
            }
        }
    }, [user, users, usersLoading, logout]);
    
    return(
       <div className="min-h-screen bg-background font-sans antialiased">
        <SetupWarning />
        <NotificationWatcher />
        <Header />
        <main className="container mx-auto p-4 md:p-8">
           <Routes>
              <Route path="/" element={!user ? <AuthPage /> : <Navigate to={user.role === Role.ADMIN ? '/admin' : '/dashboard'} replace />} />
              <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to={user.role === Role.ADMIN ? '/admin' : '/dashboard'} replace />} />
              
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={[Role.USER, Role.ADMIN]}>
                  <DashboardPage />
                </ProtectedRoute>
              } />

              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                  <AdminPage />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    );
};

const App: React.FC = () => {
  return (
    <UserProvider>
      <AuthProvider>
        <GameProvider>
          <ThemeProvider>
            <BusinessDayProvider>
              <HashRouter>
                <AppRoutes/>
              </HashRouter>
            </BusinessDayProvider>
          </ThemeProvider>
        </GameProvider>
      </AuthProvider>
    </UserProvider>
  );
};

export default App;
