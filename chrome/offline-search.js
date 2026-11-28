'use strict';

// Descriptions and aliases are shipped with the app. No query, thumbnail or favicon lookup is made.
const VaayvuDirectory = (() => {
  const featured = [
    ['Google', 'www.google.com', 'Google’s search home page.', 'गूगल గూగుల్ கூகுள் ಗೂಗಲ್ search engine'],
    ['Google Maps', 'maps.google.com', 'Maps, directions and places.', 'navigation map directions routes नक्शा'],
    ['Gmail', 'mail.google.com', 'Google’s email service.', 'mail inbox जीमेल'],
    ['Google Scholar', 'scholar.google.com', 'Find scholarly literature and citations.', 'academic papers research articles'],
    ['Google Translate', 'translate.google.com', 'Translate text between languages.', 'translation अनुवाद'],
    ['Wikipedia', 'www.wikipedia.org', 'Choose a language and explore the free encyclopedia.', 'wiki विकिपीडिया వికీపీడియా விக்கிப்பீடியா encyclopedia reference'],
    ['Internet Archive', 'archive.org', 'A digital library of books, recordings and archived websites.', 'wayback machine archive history'],
    ['OpenStreetMap', 'www.openstreetmap.org', 'Community maps of streets, trails and places around the world.', 'map directions geography'],
    ['YouTube', 'www.youtube.com', 'Video channels, music and tutorials.', 'यूट्यूब videos'],
    ['Wikimedia Commons', 'commons.wikimedia.org', 'A collection of freely reusable photographs, illustrations and media.', 'free photos pictures images'],
    ['Project Gutenberg', 'www.gutenberg.org', 'Free public-domain ebooks.', 'read books literature novels'],
    ['BBC', 'www.bbc.com', 'International news, culture and features.', 'world news headlines'],
    ['Reuters', 'www.reuters.com', 'International and business news.', 'news finance world reporting'],
    ['The Hindu', 'www.thehindu.com', 'News and analysis from India.', 'national news current affairs'],
    ['Indian Express', 'indianexpress.com', 'Indian news and reporting.', 'news headlines politics india'],
    ['GitHub', 'github.com', 'Software projects, source code and developer collaboration.', 'git open source repositories programming'],
    ['Stack Overflow', 'stackoverflow.com', 'Programming questions and answers.', 'coding developer help errors'],
    ['MDN Web Docs', 'developer.mozilla.org', 'Documentation for HTML, CSS, JavaScript and the web platform.', 'code web development programming'],
    ['Python', 'www.python.org', 'The Python programming language and its documentation.', 'code programming tutorials'],
    ['Khan Academy', 'www.khanacademy.org', 'Lessons and exercises in mathematics, science and other subjects.', 'learning school study maths math education'],
    ['arXiv', 'arxiv.org', 'Research papers in physics, mathematics, computer science and other fields.', 'preprints academic research papers'],
    ['PubMed', 'pubmed.ncbi.nlm.nih.gov', 'Search medical and life sciences literature.', 'biomedical health journals papers'],
    ['NASA', 'www.nasa.gov', 'Space missions, astronomy and Earth science.', 'space planets moon solar system'],
    ['ESA', 'www.esa.int', 'The European Space Agency’s missions and science.', 'space satellite solar system'],
    ['ISRO', 'www.isro.gov.in', 'India’s space missions, launches and satellite programmes.', 'इसरो ఇస్రో இஸ்ரோ space india chandrayaan'],
    ['National Portal of India', 'www.india.gov.in', 'Indian government departments and citizen services.', 'भारत सरकार सरकारी सेवाएं india government portals'],
    ['DigiLocker', 'www.digilocker.gov.in', 'Access digital documents issued in India.', 'digital locker documents digilocker डिजिलॉकर'],
    ['UIDAI', 'uidai.gov.in', 'Aadhaar information and services from the issuing authority.', 'aadhaar aadhar आधार ఆధార్ ஆதார்'],
    ['IRCTC', 'www.irctc.co.in', 'Indian Railways passenger ticket booking.', 'train tickets railway reservation booking ट्रेन टिकट रेल'],
    ['Indian Railways', 'indianrailways.gov.in', 'India’s railway network and passenger services.', 'train railway रेल ट्रेन timing timetable'],
    ['India Meteorological Department', 'mausam.imd.gov.in', 'Official weather forecasts and warnings for India.', 'india weather forecast rain monsoon मौसम వాతావరణం வானிலை'],
    ['Reserve Bank of India', 'www.rbi.org.in', 'India’s central bank, its reports and policy decisions.', 'rbi banking finance भारतीय रिजर्व बैंक'],
    ['India Post', 'www.indiapost.gov.in', 'Indian postal services and consignment tracking.', 'post office postal code pin pincode parcel डाक'],
    ['National Testing Agency', 'nta.ac.in', 'India’s national entrance examination agency.', 'jee main neet ug exam entrance exams results'],
    ['SWAYAM', 'swayam.gov.in', 'Online courses from Indian educational institutions.', 'education learning courses study'],
    ['Passport Seva', 'www.passportindia.gov.in', 'Indian passport applications and appointments.', 'passport renewal application पासपोर्ट'],
    ['Open Government Data India', 'www.data.gov.in', 'Datasets published by Indian government organisations.', 'statistics research data portal'],
    ['Press Information Bureau', 'pib.gov.in', 'Official releases from the Government of India.', 'pib press government news'],
    ['ESPNcricinfo', 'www.espncricinfo.com', 'Cricket scores, match coverage and statistics.', 'cricket scores क्रिकेट live score IPL'],
    ['Cricbuzz', 'www.cricbuzz.com', 'Cricket fixtures, commentary and scorecards.', 'live scores cricket IPL क्रिकेट'],
    ['IMDb', 'www.imdb.com', 'Film and television credits, cast lists and reviews.', 'movies tv cinema films actors'],
    ['Spotify', 'open.spotify.com', 'Music, podcasts and artists.', 'music songs podcasts streaming'],
    ['Apple', 'www.apple.com', 'Apple products, software and support.', 'iphone mac ipad apple store'],
    ['Microsoft', 'www.microsoft.com', 'Microsoft products and services.', 'windows office microsoft software'],
    ['Amazon India', 'www.amazon.in', 'Amazon’s shopping site for India.', 'online shopping amazon india'],
    ['Flipkart', 'www.flipkart.com', 'Online shopping in India.', 'ecommerce shopping india'],
    ['WhatsApp', 'www.whatsapp.com', 'WhatsApp messaging and calling.', 'chat messaging व्हाट्सएप'],
  ];
  const fold = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
  const filler = new Set('a an the of for to is in on what how can do and find please me about'.split(' '));
  let catalog;
  function entries() {
    if (catalog) return catalog;
    catalog = [];
    const seen = new Set();
    function site(title, host, snippet, aliases) {
      const domain = host.replace(/^www\./, '');
      if (seen.has(domain)) return;
      seen.add(domain);
      catalog.push({ kind: 'site', title, url: 'https://' + host + '/', snippet, key: fold(title),
        label: domain.split('.')[0], words: fold([title, domain, aliases, snippet].join(' ')) });
    }
    for (const [title, domain, snippet, aliases] of featured) site(title, domain, snippet, aliases);
    for (const domain of VAAYVU_SITE_DIRECTORY) site(domain, domain, '', '');
    for (const [category, titles] of VAAYVU_TOPICS) {
      for (const title of titles) {
        catalog.push({ kind: 'topic', title,
          url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replaceAll(' ', '_')),
          snippet: category, key: fold(title), words: fold(title + ' ' + category) });
      }
    }
    return catalog;
  }
  function search(input) {
    const query = fold(input);
    if (!query) return { sites: [], topics: [] };
    const all = [...new Set(query.split(' '))];
    const filtered = all.filter(term => !filler.has(term));
    const terms = filtered.length ? filtered : all;
    const hits = { site: [], topic: [] };
    for (const row of entries()) {
      if (!terms.every(term => row.words.includes(term))) continue;
      const tokens = row.words.split(' ');
      let score = terms.reduce((sum, term) => sum + (tokens.includes(term) ? 5 : tokens.some(t => t.startsWith(term)) ? 2 : 0), 0);
      if (row.key === query || row.label === query) score += 100;
      else if (row.key.startsWith(query + ' ')) score += 30;
      else if (row.key.includes(query)) score += 15;
      if (row.words.includes(query)) score += 5;
      hits[row.kind].push({ row, score });
    }
    const top = (group, count) => group.sort((a,b) => b.score - a.score).slice(0,count).map(match => match.row);
    return { sites: top(hits.site, 8), topics: top(hits.topic, 6) };
  }
  return { search };
})();
