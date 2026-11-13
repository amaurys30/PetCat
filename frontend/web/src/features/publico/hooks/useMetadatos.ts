import { useEffect } from "react";

function meta(selector: string, atributo: "name" | "property", clave: string): HTMLMetaElement {
  let elemento = document.head.querySelector<HTMLMetaElement>(selector);
  if (!elemento) {
    elemento = document.createElement("meta");
    elemento.setAttribute(atributo, clave);
    document.head.appendChild(elemento);
  }
  return elemento;
}

/**
 * Título, descripción y Open Graph de una página pública. index.html trae los de la landing
 * (los que leen los buscadores sin JavaScript); esto los cambia al navegar dentro de la app.
 */
export function useMetadatos({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  useEffect(() => {
    document.title = titulo;
    meta('meta[name="description"]', "name", "description").content = descripcion;
    meta('meta[property="og:title"]', "property", "og:title").content = titulo;
    meta('meta[property="og:description"]', "property", "og:description").content = descripcion;
  }, [titulo, descripcion]);
}
