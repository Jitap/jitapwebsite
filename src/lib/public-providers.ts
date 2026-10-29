/** Sanitized public directory from JiTap provider onboarding spreadsheet.
 * Only name, business, self-reported service areas/categories, non-contact specialty.
 * No phone numbers, emails, internal IDs, ratings, verification, live availability or home addresses.
 * Always label as self-reported onboarding data.
 */
export const serviceAreas=["Bamburi","Nyali","Mtwapa","Tudor","Changamwe","Likoni"] as const;
export const publicProviders=[
  {
    "id": "provider-001",
    "name": "David Ochola",
    "business": "Interior designer",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Carpentry / Furniture",
      "Other"
    ],
    "specialty": "Interior decor and MDF woodwork"
  },
  {
    "id": "provider-002",
    "name": "Sharon.k",
    "business": "AirBNB host",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Other"
    ],
    "specialty": "Airbnb hosting"
  },
  {
    "id": "provider-003",
    "name": "Harrison Kiarie",
    "business": "Architectural and interior design services",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa"
    ],
    "categories": [
      "Carpentry / Furniture",
      "Masonry / Construction",
      "Welding / Metalwork",
      "Other"
    ],
    "specialty": "Architecture and interior design"
  },
  {
    "id": "provider-004",
    "name": "Dominic Muange",
    "business": "Butchery, Grilling/Nyama Choma",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa"
    ],
    "categories": [
      "Other"
    ],
    "specialty": "Food preparation and nyama choma"
  },
  {
    "id": "provider-005",
    "name": "Edwin Mogeni",
    "business": "NEXORA – CCTV, solar and IT",
    "areas": [
      "Mtwapa"
    ],
    "categories": [
      "IT / Phone / Computer Services",
      "Other"
    ],
    "specialty": "CCTV, solar and IT installation"
  },
  {
    "id": "provider-006",
    "name": "Salmon Adeya",
    "business": "Bnb services",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Other"
    ],
    "specialty": "Airbnb services"
  },
  {
    "id": "provider-007",
    "name": "Zuberi Mohamed",
    "business": "Carpentry",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Carpentry / Furniture"
    ],
    "specialty": ""
  },
  {
    "id": "provider-008",
    "name": "Julius Gachoki",
    "business": "Carpentry",
    "areas": [
      "Bamburi",
      "Nyali"
    ],
    "categories": [
      "Carpentry / Furniture"
    ],
    "specialty": ""
  },
  {
    "id": "provider-009",
    "name": "Salim Kazungu",
    "business": "Carpentry",
    "areas": [
      "Bamburi",
      "Nyali"
    ],
    "categories": [
      "Carpentry / Furniture",
      "Other"
    ],
    "specialty": "Fittings"
  },
  {
    "id": "provider-010",
    "name": "Cavin Diang'a",
    "business": "Carpentry",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa"
    ],
    "categories": [
      "Carpentry / Furniture"
    ],
    "specialty": ""
  },
  {
    "id": "provider-011",
    "name": "Don Ben",
    "business": "Transport and mechanic",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Appliance Repair",
      "Mechanic / Auto Services",
      "Laundry",
      "Pest Control"
    ],
    "specialty": ""
  },
  {
    "id": "provider-012",
    "name": "Elijah Ochieng",
    "business": "Carpentry",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Carpentry / Furniture"
    ],
    "specialty": ""
  },
  {
    "id": "provider-013",
    "name": "Benard Rogito",
    "business": "Carpentry, masonry and welding",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Carpentry / Furniture",
      "Masonry / Construction",
      "Welding / Metalwork"
    ],
    "specialty": ""
  },
  {
    "id": "provider-014",
    "name": "Architect Herbert Makori",
    "business": "Architecture and building approvals",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Masonry / Construction",
      "Other"
    ],
    "specialty": "Building approvals"
  },
  {
    "id": "provider-015",
    "name": "Baraka Ngala",
    "business": "Vehicle mechanic",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Mechanic / Auto Services"
    ],
    "specialty": ""
  },
  {
    "id": "provider-016",
    "name": "Abraham Sakwa",
    "business": "Painting",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Painting"
    ],
    "specialty": ""
  },
  {
    "id": "provider-017",
    "name": "Cyrus Makau",
    "business": "Winkitel Solutions",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Electrical",
      "Other"
    ],
    "specialty": "Electrical, solar and gypsum"
  },
  {
    "id": "provider-018",
    "name": "Moses Kibaya",
    "business": "Electrical and TV mounting",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Electrical"
    ],
    "specialty": "Electrical, hot shower and fan installation"
  },
  {
    "id": "provider-019",
    "name": "Kate Wanjohi",
    "business": "Fresh juice and eggs",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Other"
    ],
    "specialty": "Fresh juice and eggs"
  },
  {
    "id": "provider-020",
    "name": "Caroline Munyi",
    "business": "Channah Cakes & Events",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Other"
    ],
    "specialty": "Bakery and events"
  },
  {
    "id": "provider-021",
    "name": "Noel Otieno Obonyo",
    "business": "Ink Concepts Ltd / Events",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Other"
    ],
    "specialty": "Event management"
  },
  {
    "id": "provider-022",
    "name": "URBAN MOVERS AND RELOCATIONS",
    "business": "House Moving",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Moving / Delivery",
      "Other"
    ],
    "specialty": "Moving and interior decor"
  },
  {
    "id": "provider-023",
    "name": "Benzino Maoga",
    "business": "Interior design",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Other"
    ],
    "specialty": "Interior design"
  },
  {
    "id": "provider-024",
    "name": "Linda Buluma",
    "business": "Tahight Ventures",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Cleaning",
      "Gardening / Landscaping",
      "Pest Control",
      "Other"
    ],
    "specialty": "Blinds and mosquito net installation"
  },
  {
    "id": "provider-025",
    "name": "Riziki Hassan Kutsola",
    "business": "Salonist",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Beauty / Barber / Salon"
    ],
    "specialty": ""
  },
  {
    "id": "provider-026",
    "name": "Justus Masila",
    "business": "Justus Phone Repair",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "IT / Phone / Computer Services"
    ],
    "specialty": ""
  },
  {
    "id": "provider-027",
    "name": "Julius Mwatsuma",
    "business": "Bicycle sales and repair",
    "areas": [
      "Bamburi",
      "Nyali"
    ],
    "categories": [
      "Other"
    ],
    "specialty": "Bicycle repair"
  },
  {
    "id": "provider-028",
    "name": "Norah Masinde",
    "business": "Cleaning services",
    "areas": [
      "Bamburi",
      "Nyali"
    ],
    "categories": [
      "Cleaning"
    ],
    "specialty": ""
  },
  {
    "id": "provider-029",
    "name": "Michael Ochieng Onyonga",
    "business": "Interior design",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Painting",
      "Carpentry / Furniture"
    ],
    "specialty": ""
  },
  {
    "id": "provider-030",
    "name": "Joscoh Karanja",
    "business": "Barber and salon",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Beauty / Barber / Salon"
    ],
    "specialty": ""
  },
  {
    "id": "provider-031",
    "name": "Steve",
    "business": "Technician / Engineer",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Appliance Repair",
      "Moving / Delivery"
    ],
    "specialty": ""
  },
  {
    "id": "provider-032",
    "name": "Amos Tumaini",
    "business": "Electrical and plumbing",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa"
    ],
    "categories": [
      "Plumbing",
      "Electrical",
      "Painting",
      "Gardening / Landscaping",
      "Pest Control"
    ],
    "specialty": ""
  },
  {
    "id": "provider-033",
    "name": "Alexander Mandela",
    "business": "Refrigeration and air conditioning",
    "areas": [
      "Bamburi"
    ],
    "categories": [
      "Appliance Repair"
    ],
    "specialty": "Refrigeration and air conditioning"
  },
  {
    "id": "provider-034",
    "name": "Jimmy Opanda",
    "business": "Appliances, electrical and glass",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Electrical",
      "Masonry / Construction",
      "Appliance Repair",
      "Laundry"
    ],
    "specialty": ""
  },
  {
    "id": "provider-035",
    "name": "Jared Bulimo",
    "business": "Electrical and electronics repairs",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "Electrical",
      "Appliance Repair"
    ],
    "specialty": "TV and microwave repair"
  },
  {
    "id": "provider-036",
    "name": "Paul Onyango Oloo",
    "business": "ZenoTech Computers",
    "areas": [
      "Bamburi",
      "Nyali",
      "Mtwapa",
      "Tudor"
    ],
    "categories": [
      "IT / Phone / Computer Services"
    ],
    "specialty": ""
  }
] as const;
export type PublicProvider=(typeof publicProviders)[number];
export const providerCategoryLabels=["Plumbing","Electrical","Cleaning","Painting","Carpentry / Furniture","Appliance Repair","General Repairs","IT / Phone / Computer Services","Masonry / Construction","Welding / Metalwork","Mechanic / Auto Services","Moving / Delivery","Gardening / Landscaping","Pest Control","Laundry","Beauty / Barber / Salon","Other"];
