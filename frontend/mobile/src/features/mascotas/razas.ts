// Sugerencias de raza (lista local; la API guarda la raza como texto libre de hasta 100
// caracteres). Se puede escribir cualquier otra. Nombres como se usan en Colombia.

const PERROS = [
  "Criollo",
  "Mestizo",
  "Labrador Retriever",
  "Golden Retriever",
  "Pastor Alemán",
  "Bulldog Francés",
  "Bulldog Inglés",
  "Poodle",
  "French Poodle",
  "Caniche Toy",
  "Schnauzer",
  "Schnauzer Miniatura",
  "Shih Tzu",
  "Yorkshire Terrier",
  "Chihuahua",
  "Pug",
  "Beagle",
  "Pinscher Miniatura",
  "Pitbull",
  "American Bully",
  "Rottweiler",
  "Boxer",
  "Dóberman",
  "Husky Siberiano",
  "Malamute de Alaska",
  "Border Collie",
  "Collie",
  "Pastor Australiano",
  "Pastor Belga Malinois",
  "Cocker Spaniel",
  "Cavalier King Charles",
  "Maltés",
  "Bichón Frisé",
  "Bichón Maltés",
  "Pomerania",
  "Lhasa Apso",
  "Dálmata",
  "Gran Danés",
  "San Bernardo",
  "Bernés de la Montaña",
  "Akita Inu",
  "Shiba Inu",
  "Chow Chow",
  "Shar Pei",
  "Basset Hound",
  "Dachshund (Salchicha)",
  "Jack Russell Terrier",
  "Fox Terrier",
  "Bull Terrier",
  "Staffordshire Bull Terrier",
  "West Highland White Terrier",
  "Weimaraner",
  "Pointer",
  "Setter Irlandés",
  "Galgo",
  "Whippet",
  "Samoyedo",
  "Mastín Napolitano",
  "Cane Corso",
  "Corgi Galés",
  "Pequinés",
  "Bulldog Americano",
  "Dogo Argentino",
  "Fila Brasileiro",
  "Terranova",
];

const GATOS = [
  "Criollo",
  "Mestizo",
  "Persa",
  "Siamés",
  "Angora",
  "Angora Turco",
  "Maine Coon",
  "Bengalí",
  "Ragdoll",
  "Británico de Pelo Corto",
  "Azul Ruso",
  "Esfinge",
  "Scottish Fold",
  "Himalayo",
  "Bombay",
  "Exótico de Pelo Corto",
  "Abisinio",
  "Birmano",
  "Bosque de Noruega",
  "Siberiano",
  "Oriental",
  "Devon Rex",
  "Cornish Rex",
];

export const RAZAS: Record<string, string[]> = {
  perro: [...new Set(PERROS)],
  gato: GATOS,
};

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Hasta `maximo` razas de la especie que contienen el texto (sin tildes ni mayúsculas); primero las que empiezan así. */
export function buscarRazas(especie: string, texto: string, maximo = 6): string[] {
  const lista = RAZAS[especie] ?? [];
  const buscado = normalizar(texto);
  if (!buscado) return [];
  const coinciden = lista.filter((r) => normalizar(r).includes(buscado));
  const empiezan = coinciden.filter((r) => normalizar(r).startsWith(buscado));
  const resto = coinciden.filter((r) => !normalizar(r).startsWith(buscado));
  return [...empiezan, ...resto].filter((r) => normalizar(r) !== buscado).slice(0, maximo);
}
