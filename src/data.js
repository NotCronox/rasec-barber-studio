window.RASEC_BARBERIA_DATA = {
  business: {
    name: "Rasec Barber Studio",
    shortName: "Rasec",
    initials: "RB",
    subtitle: "Barberia premium",
    description:
      "Una barberia urbana para cortes precisos, barba cuidada y una experiencia sin afan.",
    address: "Calle del Arsenal #8-13",
    neighborhood: "Centro Historico",
    city: "Cartagena",
    mapQuery: "Centro Historico, Cartagena, Colombia",
    phone: "+57 300 123 4567",
    whatsapp: "573001234567",
    email: "hola@rasecbarber.com",
    instagram: "@rasecbarber",
  },

  identity: {
    concept:
      "Un espacio para llegar, bajar el ritmo y salir con un corte que se sienta natural en tu dia a dia.",
    promise: [
      "Cortes limpios",
      "Barba detallada",
      "Atencion puntual",
      "Estilo personalizado",
    ],
    highlights: [
      { value: "4.9", label: "Calificacion" },
      { value: "35 min", label: "Promedio por cita" },
      { value: "6 dias", label: "Atencion semanal" },
    ],
  },

  media: {
    hero:
      "https://images.pexels.com/photos/30547746/pexels-photo-30547746.jpeg?auto=compress&cs=tinysrgb&w=1800",
  },

  hero: {
    eyebrow: "Barberia profesional",
    title: "Tu estilo. Tu momento.",
    text:
      "Cortes, barba y estilo personalizado en un espacio pensado para verte impecable.",
    primaryCta: "Reservar cita",
    secondaryCta: "Ver servicios",
  },

  services: [
    {
      id: "corte-clasico",
      name: "Corte clasico",
      description: "Corte limpio, equilibrado y facil de mantener.",
      price: 25000,
      currency: "COP",
      durationMinutes: 30,
      image:
        "https://images.pexels.com/photos/35157693/pexels-photo-35157693.jpeg?auto=compress&cs=tinysrgb&w=900",
      tags: ["Tijera", "Peine", "Perfilado"],
      available: true,
    },
    {
      id: "fade",
      name: "Fade profesional",
      description: "Degradado preciso con acabado natural o marcado.",
      price: 32000,
      currency: "COP",
      durationMinutes: 40,
      image:
        "https://images.pexels.com/photos/35157692/pexels-photo-35157692.jpeg?auto=compress&cs=tinysrgb&w=900",
      tags: ["Maquina", "Detalle", "Estilo"],
      available: true,
    },
    {
      id: "barba",
      name: "Barba y contorno",
      description: "Diseno de barba, navaja y producto hidratante.",
      price: 22000,
      currency: "COP",
      durationMinutes: 25,
      image:
        "https://images.pexels.com/photos/3998413/pexels-photo-3998413.jpeg?auto=compress&cs=tinysrgb&w=900",
      tags: ["Navaja", "Toalla", "Aceite"],
      available: true,
    },
    {
      id: "corte-barba",
      name: "Corte + barba",
      description: "Experiencia completa para salir listo de una vez.",
      price: 45000,
      currency: "COP",
      durationMinutes: 60,
      image:
        "https://images.pexels.com/photos/15194776/pexels-photo-15194776.jpeg?auto=compress&cs=tinysrgb&w=900",
      tags: ["Completo", "Premium", "Relax"],
      available: true,
    },
  ],

  barbers: [
    {
      id: "andres",
      name: "Andres Moreno",
      specialty: "Especialista en fades",
      bio: "Trabaja cortes modernos con transiciones limpias y acabados definidos.",
      image:
        "https://images.pexels.com/photos/8552627/pexels-photo-8552627.jpeg?auto=compress&cs=tinysrgb&w=900",
      available: true,
      serviceIds: ["corte-clasico", "fade", "corte-barba"],
      daysOff: ["Lunes"],
      timeOff: [],
      gallery: [
        {
          src: "https://images.pexels.com/photos/18503633/pexels-photo-18503633.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Fade en proceso con maquina de precision",
        },
        {
          src: "https://images.pexels.com/photos/6487911/pexels-photo-6487911.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Fade terminado visto desde atras",
        },
        {
          src: "https://images.pexels.com/photos/39559261/pexels-photo-39559261.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Corte con maquina en barberia moderna",
        },
        {
          src: "https://images.pexels.com/photos/39559325/pexels-photo-39559325.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Fade con barba definida en primer plano",
        },
      ],
    },
    {
      id: "mateo",
      name: "Mateo Rios",
      specialty: "Barba y navaja",
      bio: "Cuida contornos, simetria y ritual de barba con atencion al detalle.",
      image:
        "https://images.pexels.com/photos/12946033/pexels-photo-12946033.jpeg?auto=compress&cs=tinysrgb&w=900",
      available: true,
      serviceIds: ["barba", "corte-barba"],
      daysOff: ["Miercoles"],
      timeOff: [],
      gallery: [
        {
          src: "https://images.pexels.com/photos/9153970/pexels-photo-9153970.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Perfilado de bigote con navaja",
        },
        {
          src: "https://images.pexels.com/photos/3998427/pexels-photo-3998427.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Preparacion para afeitado de barba",
        },
        {
          src: "https://images.pexels.com/photos/9341770/pexels-photo-9341770.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Afeitado de barba en blanco y negro",
        },
        {
          src: "https://images.pexels.com/photos/5853394/pexels-photo-5853394.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Contorno de barba con tijera y peine",
        },
      ],
    },
    {
      id: "simon",
      name: "Simon Vega",
      specialty: "Corte clasico",
      bio: "Combina tecnica tradicional con estilos faciles de llevar a diario.",
      image:
        "https://images.pexels.com/photos/18483772/pexels-photo-18483772.jpeg?auto=compress&cs=tinysrgb&w=900",
      available: true,
      serviceIds: ["corte-clasico", "barba", "corte-barba"],
      daysOff: [],
      timeOff: [],
      gallery: [
        {
          src: "https://images.pexels.com/photos/32329615/pexels-photo-32329615.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Corte clasico en barberia contemporanea",
        },
        {
          src: "https://images.pexels.com/photos/4422102/pexels-photo-4422102.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Corte de perfil con iluminacion de estudio",
        },
        {
          src: "https://images.pexels.com/photos/11262382/pexels-photo-11262382.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Detalle de peinado con peine y navaja",
        },
        {
          src: "https://images.pexels.com/photos/32351040/pexels-photo-32351040.jpeg?auto=compress&cs=tinysrgb&w=800",
          alt: "Corte clasico en blanco y negro",
        },
      ],
    },
  ],

  imageCredits: [
    {
      label: "Silla de barberia moderna",
      source: "https://www.pexels.com/photo/vintage-style-barber-chair-in-modern-barbershop-30547746/",
      author: "MaGicA Production",
    },
    {
      label: "Cliente en barberia",
      source: "https://www.pexels.com/photo/man-sitting-in-barbershop-chair-15194776/",
      author: "Lewis Staff",
    },
    {
      label: "Arreglo de barba",
      source: "https://www.pexels.com/photo/man-getting-a-beard-cut-3998413/",
      author: "cottonbro studio",
    },
    {
      label: "Corte moderno",
      source: "https://www.pexels.com/photo/young-man-getting-a-haircut-in-barbershop-35157693/",
      author: "mk photos",
    },
    {
      label: "Fade profesional",
      source: "https://www.pexels.com/photo/barbershop-haircut-for-black-male-client-35157692/",
      author: "mk photos",
    },
    {
      label: "Retrato de Andres Moreno",
      source: "https://www.pexels.com/photo/a-barber-with-tattoos-8552627/",
      author: "EJ Agumbay",
    },
    {
      label: "Retrato de Mateo Rios",
      source:
        "https://www.pexels.com/photo/a-barber-wearing-apron-standing-a-mirror-while-looking-at-the-camera-12946033/",
      author: "Jimmy Maffio",
    },
    {
      label: "Retrato de Simon Vega",
      source: "https://www.pexels.com/photo/portrait-of-a-happy-barber-18483772/",
      author: "Marcelo Verfe",
    },
    {
      label: "Galeria Andres: fade en proceso",
      source: "https://www.pexels.com/photo/a-person-using-clippers-18503633/",
      author: "Hamidoff Studio",
    },
    {
      label: "Galeria Andres: fade terminado",
      source: "https://www.pexels.com/photo/mans-close-crop-hairstyle-6487911/",
      author: "mths",
    },
    {
      label: "Galeria Andres: corte con maquina",
      source: "https://www.pexels.com/photo/professional-haircut-in-modern-barber-shop-39559261/",
      author: "Brian Silva",
    },
    {
      label: "Galeria Andres: fade con barba",
      source: "https://www.pexels.com/photo/close-up-portrait-of-man-with-stylish-haircut-39559325/",
      author: "Brian Silva",
    },
    {
      label: "Galeria Mateo: perfilado de bigote",
      source: "https://www.pexels.com/photo/a-man-getting-a-moustache-grooming-9153970/",
      author: "Gromakova",
    },
    {
      label: "Galeria Mateo: preparacion de afeitado",
      source: "https://www.pexels.com/photo/man-in-white-and-gray-stripe-shirt-3998427/",
      author: "cottonbro studio",
    },
    {
      label: "Galeria Mateo: afeitado en blanco y negro",
      source: "https://www.pexels.com/photo/grayscale-photo-of-woman-shaving-a-full-bearded-man-9341770/",
      author: "mk7 Bober",
    },
    {
      label: "Galeria Mateo: contorno de barba",
      source: "https://www.pexels.com/photo/hands-of-a-person-trimming-a-man-s-beard-5853394/",
      author: "Alexandre Saraiva Carniato",
    },
    {
      label: "Galeria Simon: corte contemporaneo",
      source: "https://www.pexels.com/photo/professional-haircut-at-modern-barbershop-32329615/",
      author: "bulat843",
    },
    {
      label: "Galeria Simon: corte de perfil",
      source: "https://www.pexels.com/photo/a-man-having-a-haircut-4422102/",
      author: "Maksgelatin",
    },
    {
      label: "Galeria Simon: detalle de peinado",
      source: "https://www.pexels.com/photo/hairdresser-doing-a-haircut-11262382/",
      author: "S Minh",
    },
    {
      label: "Galeria Simon: corte en blanco y negro",
      source: "https://www.pexels.com/photo/black-and-white-close-up-barbershop-haircut-32351040/",
      author: "Sephina Cornwall",
    },
  ],

  hours: [
    { day: "Lunes", open: true, start: "10:00", end: "19:00" },
    { day: "Martes", open: true, start: "10:00", end: "19:00" },
    { day: "Miercoles", open: true, start: "10:00", end: "19:00" },
    { day: "Jueves", open: true, start: "10:00", end: "20:00" },
    { day: "Viernes", open: true, start: "10:00", end: "20:00" },
    { day: "Sabado", open: true, start: "09:00", end: "17:00" },
    { day: "Domingo", open: false, start: null, end: null },
  ],

  settings: {
    bookingWindowDays: 30,
  },

  notes: {
    title: "Recomendacion",
    body:
      "Llega cinco minutos antes. Si quieres un cambio grande de estilo, escribe primero para separar mas tiempo.",
  },

  cta: {
    title: "Agenda tu cita con Rasec Barber Studio.",
    text: "Elige tu barbero, el dia y la hora en menos de un minuto.",
    whatsappMessage:
      "Hola, tengo una pregunta sobre Rasec Barber Studio.",
  },
};
