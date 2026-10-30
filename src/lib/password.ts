// Sin caracteres ambiguos (0 O o 1 l I) para que sea fácil de dictar o copiar.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const ESPECIALES = '-_.!#'

/** Contraseña temporal de 16 caracteres con aleatoriedad criptográfica. */
export function generarPassword(): string {
  const n = 16
  const cs = new Uint32Array(n)
  crypto.getRandomValues(cs)
  const chars = Array.from(cs, (c) => ALFABETO[c % ALFABETO.length])
  chars[3] = ESPECIALES[cs[3] % ESPECIALES.length]
  chars[10] = ESPECIALES[cs[10] % ESPECIALES.length]
  return chars.join('')
}
