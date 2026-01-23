import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Car, Shield, Search, FileText, BarChart3, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen gradient-cinematic-radial flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-cinematic-radial relative overflow-hidden">
      {/* Geometric accent elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-accent/10 to-transparent rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-orange-burnt/15 to-transparent rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute top-1/2 left-1/4 w-1 h-32 bg-gradient-to-b from-cyan-accent/40 to-transparent rotate-45" />
      <div className="absolute top-1/3 right-1/4 w-1 h-24 bg-gradient-to-b from-orange-burnt/40 to-transparent -rotate-45" />

      {/* Header */}
      <header className="relative z-10 container py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">Pátio Veículos</span>
          </div>
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
          >
            Entrar
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 container">
        <section className="py-20 lg:py-32 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Sistema de Gerenciamento de{" "}
              <span className="text-gradient-orange">Pátio de Veículos</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Controle completo de veículos apreendidos com rastreamento de perícias, 
              busca avançada e relatórios detalhados. Simplifique sua gestão.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => window.location.href = getLoginUrl()}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-lg glow-orange"
              >
                Acessar Sistema
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Funcionalidades <span className="text-gradient-cyan">Completas</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Tudo que você precisa para gerenciar veículos apreendidos de forma eficiente
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Card 1 */}
            <div className="group p-6 rounded-xl bg-card/50 border border-border hover:border-primary/50 transition-all duration-300 hover:glow-orange">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Car className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Cadastro Completo</h3>
              <p className="text-muted-foreground">
                Registre veículos com duas placas, dados do procedimento, processo e observações detalhadas.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="group p-6 rounded-xl bg-card/50 border border-border hover:border-accent/50 transition-all duration-300 hover:glow-cyan">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Busca Avançada</h3>
              <p className="text-muted-foreground">
                Encontre veículos por placa, processo, procedimento ou datas de cadastro e devolução.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="group p-6 rounded-xl bg-card/50 border border-border hover:border-primary/50 transition-all duration-300 hover:glow-orange">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Controle de Perícia</h3>
              <p className="text-muted-foreground">
                Acompanhe o status de perícia: pendente, sem perícia ou concluída para cada veículo.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div className="group p-6 rounded-xl bg-card/50 border border-border hover:border-accent/50 transition-all duration-300 hover:glow-cyan">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Exportação de Dados</h3>
              <p className="text-muted-foreground">
                Exporte relatórios em CSV ou Excel para análise externa e integração com outros sistemas.
              </p>
            </div>

            {/* Feature Card 5 */}
            <div className="group p-6 rounded-xl bg-card/50 border border-border hover:border-primary/50 transition-all duration-300 hover:glow-orange">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Dashboard Estatístico</h3>
              <p className="text-muted-foreground">
                Visualize estatísticas em tempo real: veículos no pátio, devolvidos e perícias pendentes.
              </p>
            </div>

            {/* Feature Card 6 */}
            <div className="group p-6 rounded-xl bg-card/50 border border-border hover:border-accent/50 transition-all duration-300 hover:glow-cyan">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">100% Responsivo</h3>
              <p className="text-muted-foreground">
                Acesse de qualquer dispositivo: desktop, tablet ou smartphone com interface adaptativa.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20" />
            <div className="absolute inset-0 border border-primary/30 rounded-2xl" />
            <div className="relative p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Pronto para começar?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Faça login para acessar o sistema e começar a gerenciar seu pátio de veículos.
              </p>
              <Button
                onClick={() => window.location.href = getLoginUrl()}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
              >
                Acessar Agora
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8">
        <div className="container text-center text-muted-foreground text-sm">
          <p>Sistema de Gerenciamento de Pátio de Veículos Apreendidos</p>
        </div>
      </footer>
    </div>
  );
}
