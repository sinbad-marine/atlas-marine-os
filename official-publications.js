const OFFICIAL_PUBLICATIONS = [
  {
    id:'nga-pub-131', title:'Sailing Directions (Enroute) Pub. 131 — Western Mediterranean',
    authority:'US National Geospatial-Intelligence Agency (NGA)', edition:'19th Edition, 2025',
    region:['Western Mediterranean','Strait of Gibraltar','Spain','France','Italy','North Africa'],
    type:'Sailing Directions', access:'official-free', status:'approved',
    url:'https://msi.nga.mil/Publications/SDEnroute', localFile:'NGA_Pub_131_Western_Mediterranean.pdf',
    notes:'Use with current official charts and Notices to Mariners.'
  },
  {
    id:'nga-pub-132', title:'Sailing Directions (Enroute) Pub. 132 — Eastern Mediterranean',
    authority:'US National Geospatial-Intelligence Agency (NGA)', edition:'17th Edition, 2026',
    region:['Eastern Mediterranean','Aegean Sea','Greece','Türkiye','Cyprus','Levant','Black Sea approaches'],
    type:'Sailing Directions', access:'official-free', status:'approved',
    url:'https://msi.nga.mil/Publications/SDEnroute', localFile:'NGA_Pub_132_Eastern_Mediterranean.pdf',
    notes:'Primary free regional pilot reference; verify weekly corrections.'
  },
  {
    id:'nga-pub-140', title:'Sailing Directions (Planning Guide) Pub. 140 — North Atlantic and Adjacent Seas',
    authority:'US National Geospatial-Intelligence Agency (NGA)', edition:'18th Edition, 2025',
    region:['North Atlantic','Mediterranean planning','Black Sea planning','Europe','North Africa'],
    type:'Planning Guide', access:'official-free', status:'approved',
    url:'https://msi.nga.mil/Publications/SDPGuides', localFile:'NGA_Pub_140_North_Atlantic_Adjacent_Seas.pdf',
    notes:'Planning-level information; not a berth-by-berth substitute.'
  },
  {
    id:'nga-pub-113', title:'List of Lights, Radio Aids and Fog Signals Pub. 113',
    authority:'US National Geospatial-Intelligence Agency (NGA)', edition:'June 2026',
    region:['Mediterranean','Black Sea','Red Sea'], type:'List of Lights',
    access:'official-free', status:'approved',
    url:'https://msi.nga.mil/Publications/NGALOL', localFile:'NGA_Pub_113_List_of_Lights.pdf',
    notes:'Confirm the latest edition and corrections before operational use.'
  },
  {
    id:'hhi-adriatic-2026', title:'Sailing Directions, Adriatic Pilot — Croatian Coast',
    authority:'Hydrographic Institute of the Republic of Croatia (HHI)', edition:'1st Edition, 2026',
    region:['Adriatic Sea','Croatia'], type:'Sailing Directions',
    access:'official-free-review', status:'metadata-only',
    url:'https://www.hhi.hr/en/products-and-services/official-navigational-publications', localFile:'HHI_Adriatic_Pilot_Croatian_Coast_2026.pdf',
    notes:'Official download is available. Keep metadata-only until reuse terms are confirmed for AI indexing.'
  }
];
if(typeof module==='object'&&module.exports)module.exports=OFFICIAL_PUBLICATIONS;
