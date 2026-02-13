/** Translations for Important Notices (passenger booking). */

export const NOTICE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "tl", label: "Tagalog" },
  { code: "ceb", label: "Bisaya" },
  { code: "zh", label: "中文" },
  { code: "de", label: "Deutsch" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
] as const;

export type NoticeLang = (typeof NOTICE_LANGUAGES)[number]["code"];

/** Notice key order matches BOOKING_NOTICES in constants.ts */
export const NOTICE_TRANSLATIONS: Record<NoticeLang, readonly string[]> = {
  en: [
    "Port or terminal fees are not included in the fare.",
    "Excess baggage (over 30 kg) may be subject to crew assessment. Hand carry is limited to 30 kg and below.",
    "For a smooth experience, please arrive 30–60 minutes before boarding so you don't miss your trip.",
    "Once the vessel has departed, we're unable to offer refunds or rebooking. Arriving early helps ensure you don't miss your sailing.",
  ],
  tl: [
    "Ang bayad sa port o terminal ay hindi kasama sa pamasahe.",
    "Ang sobrang bagahe (higit 30 kg) ay maaaring suriin ng crew. Ang hand carry ay limitado sa 30 kg at pababa.",
    "Para sa maayos na biyahe, mangyaring dumating 30–60 minuto bago ang boarding para hindi kayo mahuli ng trip.",
    "Kapag naka-alis na ang barko, hindi na kami makakapag-refund o mag-rebook. Ang maagang pagdating ay nakakatulong para hindi kayo mahuli.",
  ],
  ceb: [
    "Ang bayad sa port o terminal kay di kauban sa pamasahe—lahi ang bayad sa port o terminal.",
    "Ang sobrang bagahe (labaw sa 30 kg) puwedeng tanawon sa crew. Ang hand carry limitado sa 30 kg pa ubos.",
    "Para sa hapsay nga biyahe, palihog moabot pag sayo 30–60 minuto sa wala pa ang boarding para dili mo mauwahi o mabiyaan sa trip/byahe.",
    "Kon nakalarga na ang barko, dili na kami makahatag ug refund o rebook. Ang sayo nga pag-abot nakahatag nga dili mo mabiyaan sa trip/byahe.",
  ],
  zh: [
    "港口或碼頭費用不包含在票價內。",
    "超重行李（超過 30 公斤）可能需要船員評估。手提行李限制為 30 公斤以下。",
    "為了順利乘船，請在登船前 30–60 分鐘抵達港口。",
    "船隻離港後無法辦理退款或改期。提早抵達可避免錯過航班。",
  ],
  de: [
    "Hafen- oder Terminalgebühren sind nicht im Fahrpreis enthalten.",
    "Übergepäck (über 30 kg) kann von der Besatzung geprüft werden. Handgepäck ist auf 30 kg begrenzt.",
    "Für eine reibungslose Fahrt bitten wir Sie, 30–60 Minuten vor der Abfahrt am Hafen zu erscheinen.",
    "Nach Abfahrt des Schiffes können wir keine Erstattungen oder Umbuchungen anbieten. Ein frühes Erscheinen hilft, Ihre Fahrt nicht zu verpassen.",
  ],
  ko: [
    "항구 또는 터미널 요금은 운임에 포함되지 않습니다.",
    "초과 수하물(30kg 초과)은 승무원의 검사를 받을 수 있습니다. 기내 수하물은 30kg 이하로 제한됩니다.",
    "원활한 탑승을 위해 출발 30–60분 전에 항구에 도착해 주세요.",
    "선박 출발 후에는 환불이나 재예약이 불가합니다. 일찍 도착하시면 항해를 놓치지 않으실 수 있습니다.",
  ],
  es: [
    "Las tarifas de puerto o terminal no están incluidas en el pasaje.",
    "El equipaje excesivo (más de 30 kg) puede estar sujeto a evaluación de la tripulación. El equipaje de mano está limitado a 30 kg o menos.",
    "Para una experiencia sin contratiempos, llegue al puerto 30–60 minutos antes del embarque.",
    "Una vez que la embarcación haya zarpado, no podemos ofrecer reembolsos ni cambio de reserva. Llegar temprano ayuda a no perderse su viaje.",
  ],
};
