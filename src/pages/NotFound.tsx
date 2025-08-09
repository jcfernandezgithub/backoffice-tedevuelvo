import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <article className="text-center">
        <h1 className="text-5xl font-bold mb-3 text-foreground">404</h1>
        <p className="text-lg mb-6 text-muted-foreground">Oops! Página no encontrada</p>
        <a href="/" className="underline underline-offset-4 text-primary hover:opacity-90">
          Volver al inicio
        </a>
      </article>
    </main>
  );
};

export default NotFound;
