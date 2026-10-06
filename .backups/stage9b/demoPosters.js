export const DEMO_TEMPLATE = {
  name: 'Standard Event Poster',
  size: { width: 1080, height: 1350 },
  zones: [
    { id: 'zone-header', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
    { id: 'zone-content', type: 'content', x: 70, y: 170, w: 940, h: 640, locked: false, minFont: 16, maxFont: 54 },
    { id: 'zone-image', type: 'image', x: 70, y: 830, w: 940, h: 370, locked: false },
    { id: 'zone-footer', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
  ],
};

export const DEMO_BRAND_KIT = {
  orgName: 'Northridge Collective',
  logos: [],
  colors: {
    primary: '#4338CA',
    secondary: '#1E1B4B',
    accent: '#F59E0B',
    text: '#1E1B4B',
    background: '#FFFFFF',
  },
  fonts: {
    heading: 'Inter',
    body: 'Inter',
  },
  header: {
    height: 140,
    background: '#1E1B4B',
    alignment: 'left',
    showLogo: true,
    showOrgName: true,
  },
  footer: {
    height: 130,
    background: '#1E1B4B',
    contactText: 'hello@northridge.example',
    website: 'northridge.example',
    socials: [],
    legalText: '',
  },
};

export const SAMPLE_PROMPTS = [
  'Annual sports day on 18 Oct, 8 AM, school ground. Include registration desk and medals.',
  'Diwali night market on 2 Nov, 5 PM, town square. Food stalls and folk music.',
  'Blood donation camp on 12 Nov, 9 AM, community hall. Certificates for donors.',
  'Employee of the year awards on 5 Dec, 6 PM, auditorium. Open to all staff.',
];

export const DEMO_POSTERS = [
  {
    id: 'p1',
    category: 'Event',
    prompt: SAMPLE_PROMPTS[0],
    content: {
      title: 'Annual Sports Day',
      tagline: 'Run together. Cheer louder.',
      date: '18 Oct',
      time: '8 AM',
      venue: 'School Ground',
      details: ['Open to all houses', 'Medals for every event', 'Registration from 7 AM', 'Bring water bottles'],
    },
  },
  {
    id: 'p2',
    category: 'Festival',
    prompt: SAMPLE_PROMPTS[1],
    content: {
      title: 'Diwali Night Market',
      tagline: 'Lights, food, and folk music',
      date: '2 Nov',
      time: '5 PM',
      venue: 'Town Square',
      details: ['Family-friendly stalls', 'Live folk set at 7 PM', 'Parking on Elm Street', 'Entry is free'],
    },
  },
  {
    id: 'p3',
    category: 'Awareness',
    prompt: SAMPLE_PROMPTS[2],
    content: {
      title: 'Blood Donation Camp',
      tagline: 'One hour. A lasting gift.',
      date: '12 Nov',
      time: '9 AM',
      venue: 'Community Hall',
      details: ['Walk-in donors welcome', 'Health check on site', 'Certificate for every donor', 'Refreshments after'],
    },
  },
  {
    id: 'p4',
    category: 'Achievement',
    prompt: SAMPLE_PROMPTS[3],
    content: {
      title: 'Employee of the Year',
      tagline: 'We celebrate the people who lift the room',
      date: '5 Dec',
      time: '6 PM',
      venue: 'Auditorium',
      details: ['Open to all staff', 'Nominations close 20 Nov', 'Dinner after the awards', 'Dress: smart casual'],
    },
  },
  {
    id: 'p5',
    category: 'Notice',
    prompt: 'Library closed for inventory on 9 Oct, all day. Returns box stays open at the front desk.',
    content: {
      title: 'Library Inventory Day',
      tagline: 'Stacks closed. Returns still open.',
      date: '9 Oct',
      time: 'All day',
      venue: 'Main Library',
      details: ['No lending on this date', 'Returns box at the desk', 'Study rooms reopen 10 Oct', 'Questions: front desk'],
    },
  },
  {
    id: 'p6',
    category: 'Event',
    prompt: 'Orientation for new members on 21 Sep, 4 PM, club lounge. Bring ID and a notebook.',
    content: {
      title: 'New Member Orientation',
      tagline: 'Meet the team. Learn the ropes.',
      date: '21 Sep',
      time: '4 PM',
      venue: 'Club Lounge',
      details: ['Bring a photo ID', 'Notebooks provided', 'Tour at 5 PM', 'Snacks after the briefing'],
    },
  },
  {
    id: 'p7',
    category: 'Festival',
    prompt: 'Spring cultural evening on 14 Mar, 6:30 PM, college amphitheatre. Dance, music, and food courts.',
    content: {
      title: 'Spring Cultural Evening',
      tagline: 'Campus together under the lights',
      date: '14 Mar',
      time: '6:30 PM',
      venue: 'College Amphitheatre',
      details: ['Student performances', 'Food courts on the lawn', 'Guest pass at gate 2', 'Show ends at 9:30 PM'],
    },
  },
  {
    id: 'p8',
    category: 'Awareness',
    prompt: 'Campus clean-up drive on 22 Apr, 7 AM, west parking lot. Gloves and bags provided.',
    content: {
      title: 'Campus Clean-Up Drive',
      tagline: 'Small shifts. Cleaner grounds.',
      date: '22 Apr',
      time: '7 AM',
      venue: 'West Parking Lot',
      details: ['Gloves and bags provided', 'Two-hour shift', 'Photo at the finish', 'Open to students and staff'],
    },
  },
];
