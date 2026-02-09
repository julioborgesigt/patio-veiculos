import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Car, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function Home() {
  const { user, loading, isAuthenticated, login, loginLoading, loginError } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Preencha usuário e senha");
      return;
    }

    try {
      await login(username, password);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setError((err as { message: string }).message);
      } else {
        setError("Usuário ou senha inválidos");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-cinematic-radial flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-cinematic-radial relative overflow-hidden flex items-center justify-center">
      {/* Geometric accent elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-accent/10 to-transparent rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-orange-burnt/15 to-transparent rounded-full blur-3xl animate-pulse-glow" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
            <Car className="w-9 h-9 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Pátio Veículos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sistema de Gerenciamento de Pátio
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl bg-card/80 border border-border p-8 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
            Entrar no Sistema
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1.5">
                Usuário
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                autoComplete="username"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5"
            >
              {loginLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-xs mt-6">
          Sistema de Gerenciamento de Pátio de Veículos Apreendidos
        </p>
      </div>
    </div>
  );
}
