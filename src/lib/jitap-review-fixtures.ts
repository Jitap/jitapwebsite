// Isolated, fictional data for authenticated JiTap design review.
// Never query real customer/provider records for reviewer sessions.
const stamp='2026-11-10T12:00:00.000Z';
export const reviewerTickets=[
 {reference:'00000000-0000-4000-8000-000000000001',serviceId:'JT-00000001',
  category:'plumbing',date:'2026-11-12',time:'10:00',location:'Bamburi, Mombasa',
  area:'Bamburi',provider:'Sample provider (review only)',providerPhone:'',
  providerStatus:'Provider on the way',rematch:null,status:'on_my_way',statusLabel:'On the way',
  brief:'Demo: a kitchen sink has a leaking pipe.',scope:'Inspect pipe and repair the leak.',
  createdAt:stamp,updatedAt:stamp},
 {reference:'00000000-0000-4000-8000-000000000002',serviceId:'JT-00000002',
  category:'electrical',date:'2026-11-14',time:'14:00',location:'Nyali, Mombasa',
  area:'Nyali',provider:'Awaiting provider match',providerPhone:'',
  providerStatus:'Awaiting response',rematch:null,status:'requested',statusLabel:'Requested',
  brief:'Demo: one wall socket is not working.',scope:'Check the socket and electrical wiring.',
  createdAt:stamp,updatedAt:'2026-11-10T15:20:00.000Z'},
 {reference:'00000000-0000-4000-8000-000000000003',serviceId:'JT-00000003',
  category:'cleaning',date:'2026-11-15',time:'09:00',location:'Mtwapa, Kilifi',
  area:'Mtwapa',provider:'To be matched',providerPhone:'',
  providerStatus:'Matching',rematch:null,status:'matching',statusLabel:'Matching',
  brief:'Demo: home cleaning for a two-bedroom apartment.',scope:'Clean rooms and kitchen.',
  createdAt:stamp,updatedAt:'2026-11-10T14:10:00.000Z'},
 {reference:'00000000-0000-4000-8000-000000000004',serviceId:'JT-00000004',
  category:'moving',date:'2026-11-16',time:'13:30',location:'Tudor, Mombasa',
  area:'Tudor',provider:'Sample moving company',providerPhone:'',
  providerStatus:'Confirmed',rematch:null,status:'scheduled',statusLabel:'Booking confirmed',
  brief:'Demo: move household items from Tudor to Nyali.',scope:'Pack and move items.',
  createdAt:stamp,updatedAt:'2026-11-10T13:00:00.000Z'}
];
export const reviewerProviderDashboard={
 profile:{
  full_name:'Sena · Design Reviewer',business_name:'JiTap Design Review (Sample)',
  categories:['plumbing','electrical','general-repairs'],
  service_areas:['Bamburi','Nyali','Mtwapa'],
  base_area:'Bamburi',experience_years:5,
  skills:'Design review profile. No real provider account or customer data.',
  is_online:true,submitted_at:stamp
 },
 onboardingName:'Sena',reviewStatus:'approved',confirmedJobs:[{id:'00000000-0000-4000-8000-000000000021',requestId:'00000000-0000-4000-8000-000000000021',status:'confirmed',customerName:'Demo Customer',customerPhone:'',location:'Nyali, Mombasa',service:'electrical',latitude:null,longitude:null,placeId:'',rated:false}],
 readNotificationIds:[],opportunities:[
  {request_id:'00000000-0000-4000-8000-000000000011',category:'plumbing',area:'Bamburi',
   preferred_date:'2026-11-12',preferred_time:'10:00',created_at:stamp,
   technical_summary:'Demo: repair leaking kitchen sink.',
   proposed_scope:'Inspect connections and fix leak.',urgency:'normal',
   brief_source:'ai',requested_timing:'2026-11-12 at 10:00',job_location:'Bamburi'}
 ],
 recentResponses:[],uploadedMedia:[]
};

export const reviewerAppointments=[
 {id:'00000000-0000-4000-8000-000000000021',
  requestId:'00000000-0000-4000-8000-000000000021',
  startsAt:'2026-11-12T07:00:00.000Z',endsAt:'2026-11-12T09:00:00.000Z',
  status:'confirmed',rated:false,title:'Demo Electrical Repair',
  category:'electrical',area:'Nyali',location:'Nyali, Mombasa',
  latitude:null,longitude:null,placeId:'',customerName:'Demo Customer',customerPhone:'',
  description:'Demo: a wall socket is not working. This is not a real booking.',
  pendingReschedule:null}
];
