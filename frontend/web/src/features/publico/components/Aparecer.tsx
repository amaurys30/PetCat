import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Aparece con un desplazamiento suave al entrar en pantalla (clase `aparecer` de index.css,
 * que no anima con "reducir movimiento"). Sin IntersectionObserver se muestra de una vez.
 */
export function Aparecer({ className, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const elemento = ref.current;
    if (visible || !elemento) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [visible]);

  return <div ref={ref} data-visible={visible} className={cn("aparecer", className)} {...props} />;
}
