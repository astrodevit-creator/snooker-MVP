
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

const AuthPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message === 'Invalid email or password.' ? 'E-mail ou mot de passe invalide.' : err.message || 'Échec de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] animate-in fade-in duration-500">
      <Card className="w-full max-w-sm shadow-2xl border-2">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-black uppercase tracking-tighter">Connexion</CardTitle>
          <CardDescription className="text-xs font-medium uppercase opacity-70">
            Saisissez vos identifiants pour accéder au club.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-5">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">E-mail</label>
              <Input
                id="email"
                type="email"
                placeholder="nom@exemple.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-12 font-bold"
              />
            </div>
            <div className="grid gap-2">
              {/* Fix: changed colClassName to className as label element does not accept colClassName */}
              <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Mot de passe</label>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-12 font-bold"
              />
            </div>
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-[10px] font-black uppercase text-center animate-shake">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest shadow-lg" disabled={isLoading}>
              {isLoading ? 'Connexion...' : 'Se Connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
