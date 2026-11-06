/**
 * JiTap fundi-first trade taxonomy aliases.
 * One mapping is shared by public matching, directory filters and SOC sourcing.
 * Unknown/Other labels never create a provider match by themselves.
 */
export const tradeLabels:Record<string,string[]>={
 plumbing:['plumbing'],electrical:['electrical'],cleaning:['cleaning','laundry'],
 painting:['painting'],carpentry:['carpentry','furniture','woodwork'],
 'appliance-repair':['appliance repair','home appliances'],
 'general-repairs':['handyman','general repairs','fixture repair'],
 moving:['moving','relocation'],
 roofing:['roofing','roofer','gutter'],masonry:['masonry','construction','brick','plaster'],
 tiling:['tiling','flooring','tiles'],welding:['welding','metalwork','fabrication'],
 'air-conditioning':['ac & refrigeration','air conditioning','refrigeration','hvac'],
 'solar-security':['solar','cctv','security','electric fence'],
 'it-repairs':['it / phone / computer services','computer repair','computer & phone repair','phone repair','it support'],
 'vehicle-repair':['mechanic','auto services','vehicle repair','motorcycle repair','bicycle repair'],
 landscaping:['gardening','landscaping'],'pest-control':['pest control'],
 'glass-aluminium':['glass','aluminium']
};
export function providerMatchesTrade(category:string,providerCategories:string[]){
 const terms=tradeLabels[category]||[];
 if(!terms.length)return false;
 return providerCategories.some(label=>terms.some(term=>label.toLowerCase().includes(term)));
}
