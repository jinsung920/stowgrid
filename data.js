// Container internal dimensions (mm) and max payload (kg)
const CONTAINERS = {
  '20GP': { name: '20ft GP', L: 5898,  W: 2352, H: 2393, payload: 28000 },
  '40GP': { name: '40ft GP', L: 12032, W: 2352, H: 2393, payload: 26500 },
  '40HC': { name: '40ft HC', L: 12032, W: 2352, H: 2698, payload: 26500 },
};

// Initial product mix from Awning_Mixed_Load_Calculation_EN.xlsx
const SAMPLE_PRODUCTS = [
  { code: '813705', name: 'Wind Break Side',      L: 480,  W: 480, H: 550, weight: 0, qty: 60 },
  { code: '813702', name: 'Wind Break Front_2.5', L: 480,  W: 480, H: 550, weight: 0, qty: 40 },
  { code: '813700', name: 'Wind Break Front_2.0', L: 480,  W: 480, H: 550, weight: 0, qty: 40 },
  { code: '813712', name: 'Room 2.5',             L: 270,  W: 260, H: 560, weight: 0, qty: 50 },
  { code: '813710', name: 'Room 2.0',             L: 270,  W: 260, H: 560, weight: 0, qty: 50 },
  { code: '814720', name: 'Ensuite',              L: 1350, W: 190, H: 140, weight: 0, qty: 30 },
  { code: '814712', name: 'Hard 2.5',             L: 2640, W: 190, H: 145, weight: 0, qty: 80 },
  { code: '814710', name: 'Hard 2.0',             L: 2140, W: 190, H: 145, weight: 0, qty: 80 },
  { code: '814702', name: 'Soft 2.5',             L: 2590, W: 140, H: 120, weight: 0, qty: 100 },
  { code: '814700', name: 'Soft 2.0',             L: 2090, W: 140, H: 120, weight: 0, qty: 100 },
];

// Distinct color palette for product types
const PALETTE = [
  '#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#5f27cd',
  '#ff9ff3', '#54a0ff', '#ff9f43', '#10ac84', '#ee5a24',
  '#a55eea', '#26de81', '#fd79a8', '#fdcb6e', '#74b9ff',
  '#e17055', '#00b894', '#6c5ce7', '#fab1a0', '#81ecec',
];
