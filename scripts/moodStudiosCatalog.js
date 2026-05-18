/**
 * Official Mood Studios service catalog.
 */

const CATEGORIES = [
  'Self-Portrait Digital',
  'Self-Portrait Pro',
  'Photographer Session',
];

const SERVICES = [
  {
    name: 'Keepsake',
    description: `Good for 1 pax + 1 Kid/Pet
• Unlimited 20 mins self-shoot
• All soft copies included
• 5 enhanced copies
• 1 backdrop
• Half body portraits only`,
    price: 650,
    duration: 20,
    categoryIndex: 0,
  },
  {
    name: 'Euphoria',
    description: `Good for 1–2 pax + 1 Kid/Pet
• Unlimited 30 mins self-shoot
• 10 enhanced copies
• 2 backdrops
• All soft copies included
• Half body portraits only`,
    price: 1000,
    duration: 30,
    categoryIndex: 0,
  },
  {
    name: 'Serendipity',
    description: `Good for 3–4 pax + 1 Kid/Pet
• Unlimited 30 mins self-shoot
• 20 enhanced copies
• 2 backdrops
• All soft copies included
• Half body portraits only`,
    price: 1500,
    duration: 30,
    categoryIndex: 0,
  },
  {
    name: 'Nostalgia',
    description: `Good for 5–6 pax + 1 Kid/Pet
• Unlimited 45 mins self-shoot
• 30 enhanced copies
• Unlimited backdrops
• All soft copies included
• Half body portraits only`,
    price: 2500,
    duration: 45,
    categoryIndex: 0,
  },
  {
    name: 'Keepsake Pro',
    description: `Good for 1 pax + 1 Kid/Pet
• Unlimited 30 mins self-shoot
• 20 enhanced copies
• 5× 4R + 2 polaroids/photostrips
• All soft copies included
• 2 backdrops
• Pro backdrops & pro studio lighting
• Half and full body portraits`,
    price: 999,
    duration: 30,
    categoryIndex: 1,
  },
  {
    name: 'Euphoria Pro',
    description: `Good for 1–2 pax + 1 Kid/Pet
• Unlimited 45 mins self-shoot
• 20 enhanced copies
• 4× 4R prints + 4 photo strips
• All soft copies included
• 2 backdrops
• Pro backdrops & pro studio lighting
• Half and full body portraits`,
    price: 1999,
    duration: 45,
    categoryIndex: 1,
  },
  {
    name: 'Serendipity Pro',
    description: `Good for 3–4 pax + 1 Kid/Pet
• Unlimited 45 mins self-shoot
• 20 enhanced copies
• 8× 4R prints + 4 photo strips
• All soft copies included
• 3 backdrops
• Pro backdrops & pro studio lighting
• Half and full body portraits`,
    price: 2500,
    duration: 45,
    categoryIndex: 1,
  },
  {
    name: 'Nostalgia Pro',
    description: `Good for 5–8 pax + 1 Kid/Pet
• Unlimited 60 mins self-shoot
• 20 enhanced copies
• 10× 4R prints + 6 photo strips
• All soft copies included
• Unlimited backdrops
• Pro backdrops & pro studio lighting
• Half and full body portraits`,
    price: 4500,
    duration: 60,
    categoryIndex: 1,
  },
  {
    name: 'Maternity Shoot',
    description: `• 1 hour photoshoot
• 50–80 enhanced copies
• Unlimited outfit changes (client provided)
• 1 A4 print with frame
• All soft copies included
• Unlimited backdrops
• Pro backdrops & pro studio lighting
• HMUA included`,
    price: 7500,
    duration: 60,
    categoryIndex: 2,
  },
  {
    name: 'Solo Glam Shoot',
    description: `• 1 hour photoshoot
• 50–80 enhanced copies
• Unlimited outfit changes (client provided)
• 1 A4 print with frame
• All soft copies included
• Unlimited backdrops
• Pro backdrops & pro studio lighting
• HMUA included`,
    price: 6500,
    duration: 60,
    categoryIndex: 2,
  },
  {
    name: 'Duo Glam Shoot',
    description: `• 1 hour photoshoot
• 50–80 enhanced copies
• Unlimited outfit changes (client provided)
• 1 A4 print with frame
• All soft copies included
• Unlimited backdrops
• Pro backdrops & pro studio lighting
• HMUA for 2 included`,
    price: 8500,
    duration: 60,
    categoryIndex: 2,
  },
  {
    name: 'Kiddie Shoot',
    description: `• 1 hour photoshoot
• 50–80 enhanced copies
• Unlimited outfit changes (client provided)
• 2 A4 prints
• All soft copies included
• 1 themed background
• FREE family portrait
• Cake smash add-on +₱500`,
    price: 3500,
    duration: 60,
    categoryIndex: 2,
  },
];

module.exports = { CATEGORIES, SERVICES };
