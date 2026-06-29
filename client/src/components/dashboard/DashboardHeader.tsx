import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Car, History, LogOut, Menu, X } from "lucide-react";

type DashboardHeaderProps = {
  userName: string | null | undefined;
  onNavigateLogs: () => void;
  onLogout: () => void;
};

export function DashboardHeader({ userName, onNavigateLogs, onLogout }: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Car className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground hidden sm:block">Pátio Veículos</span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onNavigateLogs}>
            <History className="w-4 h-4 mr-2" />
            Logs
          </Button>
          <span className="text-sm text-muted-foreground">
            Olá, <span className="text-foreground font-medium">{userName || "Usuário"}</span>
          </span>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Mobile menu button */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border p-4 bg-background">
          <div className="flex flex-col gap-3">
            <span className="text-sm text-muted-foreground">
              Olá, <span className="text-foreground font-medium">{userName || "Usuário"}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={onNavigateLogs} className="justify-start">
              <History className="w-4 h-4 mr-2" />
              Logs de Atividade
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
