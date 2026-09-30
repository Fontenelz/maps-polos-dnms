// Polos iniciais, gravados no banco por scripts/migrar.ts (só na primeira vez — não sobrescreve edições).
// Coordenadas obtidas no OpenStreetMap (Nominatim).
export const polosIniciais: {
  id: string
  nome: string
  bairro: string
  coords: [number, number] | null
  aproximado?: boolean
}[] = [
  { id: 'alto-do-calhau', nome: 'Alto do Calhau', bairro: 'Altos do Calhau', coords: [-44.2557, -2.5004] },
  { id: 'angelim', nome: 'Angelim', bairro: 'Angelim', coords: [-44.2353, -2.5304] },
  { id: 'aracagy-1', nome: 'Araçagy 1 (Damha)', bairro: 'Araçagi', coords: [-44.2060, -2.4790], aproximado: true },
  { id: 'aracagy-2', nome: 'Araçagy 2 (Costa Araçagy)', bairro: 'Araçagi', coords: [-44.1944, -2.4737] },
  { id: 'aracagy-3', nome: 'Araçagy 3', bairro: 'Cidades e Fruteiras', coords: [-44.1946, -2.4842], aproximado: true },
  { id: 'aracagy-4', nome: 'Araçagy 4', bairro: 'Cidades e Fruteiras', coords: [-44.1948, -2.4818], aproximado: true },
  { id: 'chacara-brasil', nome: 'Chácara Brasil', bairro: 'Turu', coords: [-44.2180, -2.5052] },
  { id: 'cohafuma-jardins', nome: 'Cohafuma (Jardins)', bairro: 'Jardins São Luís, Cohafuma', coords: [-44.2638, -2.5051] },
  { id: 'cohama-2', nome: 'Cohama 2 (Próximo ao Supermercado Mateus)', bairro: 'Cohama', coords: [-44.2457, -2.5157] },
  { id: 'cohama-aririzal', nome: 'Cohama (Aririzal)', bairro: 'Cohama', coords: [-44.2381, -2.5145] },
  { id: 'olho-dagua', nome: "Olho D'Água", bairro: "Olho D'Água", coords: [-44.2277, -2.4840] },
  { id: 'parque-shalom', nome: 'Parque Shalom', bairro: 'Cohajap', coords: [-44.2418, -2.4925] },
  { id: 'polo-eldorado', nome: 'Polo Eldorado', bairro: 'Jardim Eldorado', coords: [-44.2300, -2.5064] },
  { id: 'polo-hype', nome: 'Polo Hype', bairro: 'A definir', coords: null },
  { id: 'recanto-vinhais-1', nome: 'Recanto do Vinhais 1', bairro: 'Recanto dos Vinhais', coords: [-44.2655, -2.5200], aproximado: true },
  { id: 'recanto-vinhais-2', nome: 'Recanto do Vinhais 2', bairro: 'Recanto dos Vinhais', coords: [-44.2625, -2.5222], aproximado: true },
  { id: 'renascenca', nome: 'Renascença', bairro: 'Jardim Renascença', coords: [-44.2901, -2.5008] },
  { id: 'turu', nome: 'Turu (General Arthur Carvalho)', bairro: 'Turu', coords: [-44.2215, -2.5157] },
]

