/**
 * Crisp, licensed reference photography for JiTap's Mombasa pilot website.
 * These are illustrative photographs, NOT JiTap-verified providers or actual jobs.
 * Sources and photographers are documented in PHOTO_CREDITS.md.
 */
export const asset = {
  coast: 'https://images.unsplash.com/photo-1564490292125-2e3c78a0ef44',
  plumber: 'https://images.unsplash.com/photo-1749532125405-70950966b0e5',
  electrical: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e',
  cleaning: 'https://images.unsplash.com/photo-1758273238415-01ec03d9ef27',
  painting: 'https://images.unsplash.com/photo-1688372199140-cade7ae820fe',
  carpentry: 'https://images.unsplash.com/photo-1687422810663-c316494f725a',
  appliance: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1'
} as const;
/** Responsive crop delivered by the image CDN; never upscale a 50px sprite. */
export function photoUrl(src:string,width=900,quality=83){
  return src+'?auto=format&fit=crop&w='+width+'&q='+quality;
}
