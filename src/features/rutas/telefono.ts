/**
 * Teléfonos tal como vienen del registro (RENIPRESS) → formato legible y marcable.
 * Fijos de Áncash: (043) + 6 dígitos; celulares: 9 dígitos que empiezan con 9.
 */
export function telefonosLegibles(crudo: string | null | undefined): string[] {
  if (!crudo) return [];
  return crudo
    .split(/[/,;]| y | o /)
    .map((parte) => parte.replace(/\D/g, ""))
    .map((d) => {
      if (d.length === 9 && d.startsWith("9")) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
      if (d.length === 9 && d.startsWith("043")) return `(043) ${d.slice(3)}`;
      if (d.length === 8 && d.startsWith("43")) return `(043) ${d.slice(2)}`;
      if (d.length === 6) return `(043) ${d}`;
      return null;
    })
    .filter((x): x is string => x !== null);
}

/** Enlace para llamar desde el celular. */
export function telHref(legible: string): string {
  return `tel:${legible.replace(/\D/g, "")}`;
}
