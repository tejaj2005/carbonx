// Public integration inventory. Never put credentials or private facility coordinates here.
export const integrations = [
  {
    id: 'weather',
    name: 'Open-Meteo weather',
    type: 'Live provider model',
    source: 'https://open-meteo.com/en/docs',
    features:
      'Temperature, humidity and wind at the selected coordinates. Used for weather context, never as industrial energy consumption.',
    status: 'Connected for metropolitan polling; site requests run when requested.',
    limitations:
      'Weather model output. Provider time can differ from retrieval time; no facility emissions attribution.',
  },
  {
    id: 'air',
    name: 'Open-Meteo / CAMS',
    type: 'Live provider model',
    source: 'https://open-meteo.com/en/docs/air-quality-api',
    features:
      'PM₂.₅, PM₁₀, NO₂, SO₂ and CO for metropolitan context; complete past 24-hour model summaries for regional advisories.',
    status: 'Eight Indian metros; server polls every 30 minutes by default.',
    limitations:
      'India AQ: about 45 km, 3-hour native output, 12-hour updates. Hourly output is modelled; not a measured station or legal finding.',
  },
  {
    id: 'station',
    name: 'CPCB via data.gov.in',
    type: 'Measured station adapter',
    source: 'https://www.data.gov.in/resource/real-time-air-quality-index-various-locations',
    features:
      'Station, pollutant, reported minimum/maximum/average and update time when the source supplies them.',
    status: 'Needs a free personal API key and live coverage validation.',
    limitations:
      'No key is bundled. Missing units and averaging periods stay unknown. No compliance assessment is inferred.',
  },
  {
    id: 'satellite',
    name: 'Earth Search / Sentinel-2',
    type: 'Dated satellite imagery',
    source: 'https://github.com/Element84/earth-search',
    features:
      'Find site imagery in two date windows, mask unsuitable pixels, calculate NDVI/NDWI and show selected scene dates/cloud coverage.',
    status:
      'Company site verification supports real requests; availability depends on location and dates.',
    limitations:
      'Not live video, ISS position or a stack-emissions meter. Imagery context cannot validate carbon credits by itself.',
  },
  {
    id: 'ai',
    name: 'Groq AI',
    type: 'Hosted AI',
    source: 'https://console.groq.com/docs/quickstart',
    features:
      'Structured report extraction, cited answers, action recommendations and alert explanations. Evidence search remains lexical.',
    status:
      'Requires GROQ_API_KEY and model access. Rules/search remain available without the key.',
    limitations:
      'Configuration is not successful inference. AI cannot automatically make legal findings or suspend licences.',
  },
  {
    id: 'company',
    name: 'Company records & observations',
    type: 'User-supplied evidence',
    source: '',
    features:
      'Reports, historical usage, submissions and facility observations with units, periods, scope and source references.',
    status: 'Authenticated uploads and submissions persist in CarbonX.',
    limitations:
      'Company-reported evidence is not independently verified telemetry. No continuous OCEMS feed is connected.',
  },
];
export const demoVerification = {
  id: 'demo-verification-v1',
  label: 'Synthetic Hyderabad review scenario',
  latitude: 17.385,
  longitude: 78.4867,
  site: 'Demo manufacturing facility',
  metric: 'Stack particulate matter',
  threshold: 50,
  unit: 'mg/Nm³',
  windowMinutes: 60,
  value: 65,
  pm25: 42,
  ndviBefore: 0.52,
  ndviAfter: 0.36,
  note: 'All scenario values and imagery effects are invented for presentation. Nothing is written to monitoring records, and no notice or email is sent.',
};
