const STORAGE_KEY = 'cleanPlacesGoogleMapsApiKey';

const els = {};
let map = null;
let markers = [];
let currentPosition = null;
let googleReady = false;
let activePlaceId = null;

const defaultCenter = { lat: 53.5511, lng: 9.9937 };

window.addEventListener('DOMContentLoaded', () => {
  Object.assign(els, {
    settingsButton: document.getElementById('settingsButton'),
    settingsDialog: document.getElementById('settingsDialog'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveKeyButton: document.getElementById('saveKeyButton'),
    clearKeyButton: document.getElementById('clearKeyButton'),
    queryInput: document.getElementById('queryInput'),
    typeSelect: document.getElementById('typeSelect'),
    locationInput: document.getElementById('locationInput'),
    useLocationButton: document.getElementById('useLocationButton'),
    radiusWrap: document.getElementById('radiusWrap'),
    radiusSelect: document.getElementById('radiusSelect'),
    ratingSelect: document.getElementById('ratingSelect'),
    reviewsInput: document.getElementById('reviewsInput'),
    sortSelect: document.getElementById('sortSelect'),
    strictTypeCheckbox: document.getElementById('strictTypeCheckbox'),
    openNowCheckbox: document.getElementById('openNowCheckbox'),
    searchButton: document.getElementById('searchButton'),
    searchHint: document.getElementById('searchHint'),
    resultSummary: document.getElementById('resultSummary'),
    statusBox: document.getElementById('statusBox'),
    resultsList: document.getElementById('resultsList'),
    mapPlaceholder: document.getElementById('mapPlaceholder'),
  });

  bindEvents();

  const storedKey = localStorage.getItem(STORAGE_KEY) || '';
  els.apiKeyInput.value = storedKey;
  if (storedKey) {
    loadGoogleMaps(storedKey);
  } else {
    els.settingsDialog.showModal();
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

function bindEvents() {
  els.settingsButton.addEventListener('click', () => els.settingsDialog.showModal());
  els.saveKeyButton.addEventListener('click', saveApiKey);
  els.clearKeyButton.addEventListener('click', clearApiKey);
  els.useLocationButton.addEventListener('click', toggleCurrentLocation);
  els.locationInput.addEventListener('input', () => {
    if (currentPosition) deactivateCurrentLocation();
  });
  els.searchButton.addEventListener('click', searchPlaces);
  els.queryInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchPlaces(); });
  els.locationInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchPlaces(); });
}

function saveApiKey() {
  const key = els.apiKeyInput.value.trim();
  if (!key) {
    showStatus('Bitte einen API-Schlüssel eintragen.');
    return;
  }
  localStorage.setItem(STORAGE_KEY, key);
  els.settingsDialog.close();
  if (!googleReady) {
    loadGoogleMaps(key);
  } else {
    location.reload();
  }
}

function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
  els.apiKeyInput.value = '';
  els.settingsDialog.close();
  showStatus('API-Schlüssel gelöscht. Lade die Seite neu, um einen anderen Schlüssel einzutragen.');
}

function loadGoogleMaps(key) {
  if (window.google?.maps) {
    initGoogle();
    return;
  }

  window.__cleanPlacesGoogleReady = initGoogle;
  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=places,marker&language=de&region=DE&loading=async&callback=__cleanPlacesGoogleReady`;
  script.onerror = () => showStatus('Google Maps konnte nicht geladen werden. Prüfe API-Schlüssel, Freigaben und Website-Beschränkung.');
  document.head.appendChild(script);
}

async function initGoogle() {
  googleReady = true;
  const { Map } = await google.maps.importLibrary('maps');
  map = new Map(document.getElementById('map'), {
    center: defaultCenter,
    zoom: 11,
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });
  els.mapPlaceholder.classList.add('hidden');
  hideStatus();
}

async function toggleCurrentLocation() {
  if (currentPosition) {
    deactivateCurrentLocation();
    return;
  }
  if (!navigator.geolocation) {
    showStatus('Dieser Browser unterstützt keine Standortabfrage.');
    return;
  }
  els.useLocationButton.textContent = 'Standort wird ermittelt …';
  navigator.geolocation.getCurrentPosition(
    pos => {
      currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      els.locationInput.value = 'Aktueller Standort';
      els.locationInput.disabled = true;
      els.radiusWrap.classList.remove('hidden');
      els.useLocationButton.textContent = '× Standortmodus beenden';
      if (map) {
        map.setCenter(currentPosition);
        map.setZoom(13);
      }
    },
    err => {
      els.useLocationButton.textContent = '◎ Aktueller Standort';
      const reason = err.code === 1 ? 'Standortzugriff wurde nicht erlaubt.' : 'Standort konnte nicht bestimmt werden.';
      showStatus(reason);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function deactivateCurrentLocation() {
  currentPosition = null;
  els.locationInput.disabled = false;
  els.locationInput.value = '';
  els.radiusWrap.classList.add('hidden');
  els.useLocationButton.textContent = '◎ Aktueller Standort';
}

async function searchPlaces() {
  if (!googleReady) {
    els.settingsDialog.showModal();
    return;
  }

  const query = els.queryInput.value.trim();
  const type = els.typeSelect.value;
  const locationText = currentPosition ? '' : els.locationInput.value.trim();
  const minRating = Number(els.ratingSelect.value);
  const minReviews = Math.max(0, Number(els.reviewsInput.value) || 0);
  const openNow = els.openNowCheckbox.checked;
  const strictType = els.strictTypeCheckbox.checked && Boolean(type);
  const radiusKm = Number(els.radiusSelect.value);

  if (!query && !type) {
    showStatus('Bitte Suchbegriff oder Kategorie angeben.');
    return;
  }
  if (!currentPosition && !locationText) {
    showStatus('Bitte einen Ort eingeben oder den aktuellen Standort verwenden.');
    return;
  }

  setLoading(true);
  hideStatus();

  try {
    const { Place } = await google.maps.importLibrary('places');
    const textQuery = currentPosition ? (query || selectedTypeLabel()) : `${query || selectedTypeLabel()} in ${locationText}`;

    const request = {
      textQuery,
      fields: [
        'id', 'displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount',
        'businessStatus', 'primaryTypeDisplayName', 'googleMapsURI'
      ],
      maxResultCount: 20,
      language: 'de',
      region: 'DE',
    };

    if (type) {
      request.includedType = type;
      request.useStrictTypeFiltering = strictType;
    }
    if (minRating > 0) request.minRating = minRating;
    if (openNow) request.isOpenNow = true;
    if (currentPosition) request.locationRestriction = boundsAround(currentPosition, radiusKm);

    const { places } = await Place.searchByText(request);
    let results = (places || []).map(place => toResult(place));

    // Hard client-side checks as a second safety net.
    results = results.filter(p => (p.rating ?? 0) >= minRating || minRating === 0);
    results = results.filter(p => (p.userRatingCount ?? 0) >= minReviews);

    if (currentPosition) {
      results.forEach(p => {
        if (p.location) p.distanceKm = haversineKm(currentPosition, p.location);
      });
      results = results.filter(p => p.distanceKm == null || p.distanceKm <= radiusKm + 0.03);
    }

    results = sortResults(results, els.sortSelect.value);
    renderResults(results, places?.length || 0, minReviews, minRating);
    renderMarkers(results);
  } catch (error) {
    console.error(error);
    const message = error?.message || String(error);
    showStatus(`Suche fehlgeschlagen: ${message}`);
    els.resultSummary.textContent = 'Die Suche konnte nicht ausgeführt werden.';
  } finally {
    setLoading(false);
  }
}

function toResult(place) {
  const loc = place.location;
  return {
    id: place.id,
    name: place.displayName || 'Unbenannter Ort',
    location: loc ? { lat: loc.lat(), lng: loc.lng() } : null,
    address: place.formattedAddress || '',
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    type: place.primaryTypeDisplayName || '',
    status: place.businessStatus,
    googleMapsURI: place.googleMapsURI || '',
    distanceKm: null,
  };
}

function renderResults(results, rawCount, minReviews, minRating) {
  els.resultsList.innerHTML = '';
  activePlaceId = null;

  const filterText = [
    minRating > 0 ? `≥ ${minRating.toFixed(1).replace('.', ',')} ★` : null,
    minReviews > 0 ? `≥ ${minReviews} Rezensionen` : null,
  ].filter(Boolean).join(' · ');

  if (!results.length) {
    els.resultSummary.textContent = `0 Treffer${filterText ? ` · ${filterText}` : ''}`;
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = rawCount > 0
      ? 'Google hat Kandidaten geliefert, aber nach deinen harten Filtern bleibt kein Treffer übrig.'
      : 'Keine passenden Orte gefunden.';
    els.resultsList.appendChild(empty);
    return;
  }

  els.resultSummary.textContent = `${results.length} Treffer${filterText ? ` · ${filterText}` : ''}`;

  for (const result of results) {
    const card = document.createElement('article');
    card.className = 'result-card';
    card.dataset.placeId = result.id;

    const left = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'result-title';
    title.textContent = result.name;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const rating = document.createElement('span');
    rating.className = 'rating';
    rating.textContent = result.rating != null ? `${result.rating.toFixed(1).replace('.', ',')} ★` : 'keine Bewertung';
    const reviews = document.createElement('span');
    reviews.textContent = `${formatNumber(result.userRatingCount || 0)} Rezensionen`;
    meta.append(rating, reviews);
    if (result.type) {
      const type = document.createElement('span');
      type.textContent = result.type;
      meta.appendChild(type);
    }
    if (result.distanceKm != null) {
      const dist = document.createElement('span');
      dist.textContent = formatDistance(result.distanceKm);
      meta.appendChild(dist);
    }

    const address = document.createElement('div');
    address.className = 'address';
    address.textContent = result.address;
    left.append(title, meta, address);

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    if (result.googleMapsURI) {
      const link = document.createElement('a');
      link.className = 'map-link';
      link.href = result.googleMapsURI;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Google Maps ↗';
      actions.appendChild(link);
    }

    card.append(left, actions);
    card.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      focusResult(result.id, result.location);
    });
    els.resultsList.appendChild(card);
  }
}

async function renderMarkers(results) {
  if (!map) return;
  markers.forEach(m => m.map = null);
  markers = [];

  const valid = results.filter(r => r.location);
  if (!valid.length) return;

  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const bounds = new google.maps.LatLngBounds();

  for (const result of valid) {
    const marker = new AdvancedMarkerElement({
      map,
      position: result.location,
      title: `${result.name}${result.rating != null ? ` · ${result.rating.toFixed(1)} ★` : ''}`,
    });
    marker.__placeId = result.id;
    marker.addListener('click', () => {
      focusResult(result.id, result.location);
      document.querySelector(`[data-place-id="${CSS.escape(result.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    markers.push(marker);
    bounds.extend(result.location);
  }

  if (valid.length === 1) {
    map.setCenter(valid[0].location);
    map.setZoom(15);
  } else {
    map.fitBounds(bounds, 55);
  }
}

function focusResult(id, location) {
  activePlaceId = id;
  document.querySelectorAll('.result-card').forEach(card => {
    card.classList.toggle('active', card.dataset.placeId === id);
  });
  if (map && location) {
    map.panTo(location);
    if ((map.getZoom() || 0) < 14) map.setZoom(14);
  }
}

function sortResults(results, mode) {
  const arr = [...results];
  if (mode === 'reviews') {
    arr.sort((a,b) => (b.userRatingCount || 0) - (a.userRatingCount || 0) || (b.rating || 0) - (a.rating || 0));
  } else if (mode === 'distance') {
    arr.sort((a,b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || (b.rating || 0) - (a.rating || 0));
  } else if (mode === 'name') {
    arr.sort((a,b) => a.name.localeCompare(b.name, 'de'));
  } else {
    arr.sort((a,b) => (b.rating || 0) - (a.rating || 0) || (b.userRatingCount || 0) - (a.userRatingCount || 0));
  }
  return arr;
}

function boundsAround(center, radiusKm) {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180));
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function selectedTypeLabel() {
  return els.typeSelect.options[els.typeSelect.selectedIndex]?.text || 'Ort';
}

function formatNumber(n) {
  return new Intl.NumberFormat('de-DE').format(n);
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`;
}

function setLoading(on) {
  els.searchButton.disabled = on;
  els.searchButton.textContent = on ? 'Suche …' : 'Suchen';
}

function showStatus(text) {
  els.statusBox.textContent = text;
  els.statusBox.classList.remove('hidden');
}

function hideStatus() {
  els.statusBox.classList.add('hidden');
  els.statusBox.textContent = '';
}
