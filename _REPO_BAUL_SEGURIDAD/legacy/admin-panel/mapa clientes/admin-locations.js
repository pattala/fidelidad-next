// admin-locations.js
// Renderiza ubicaciones redondeadas de clientes en Google Maps (marcadores o heatmap)

let map, heatmap, markers = [];
let db;

// ---------------------------
// Firebase: init simple (ADMIN VIEW)
// ---------------------------
function setupFirebaseAdmin() {
  // ⚠️ Reemplazá por TU CONFIG (la misma que usás en la PWA)
  const firebaseConfig = {
    apiKey: "AIzaSyAvBw_Cc-t8lfip_FtQ1w_w3DrPDYpxINs",
  authDomain: "sistema-fidelizacion.firebaseapp.com",
  projectId: "sistema-fidelizacion",
  storageBucket: "sistema-fidelizacion.firebasestorage.app",
  messagingSenderId: "357176214962",
  appId: "1:357176214962:web:6c1df9b74ff0f3779490ab",
  measurementId: "G-X3PWWJWDR1"
  };
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.firestore();
}

// ---------------------------
// Firestore → obtener puntos
// ---------------------------
/**
 * mode:
 *  - "last"        => usa lastLocationRounded
 *  - "morning"     => usa timeSlots.morning.centerRounded
 *  - "afternoon"   => usa timeSlots.afternoon.centerRounded
 *  - "evening"     => usa timeSlots.evening.centerRounded
 * days: filtra por recencia (capturedAt) si existe (en cada campo)
 */
async function fetchClientPoints(mode = 'last', days = 90) {
  const out = [];

  // Traemos la colección clientes completa (en prod podés paginar)
  const snap = await db.collection('clientes').get();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  snap.forEach(doc => {
    const d = doc.data() || {};
    let lat3, lng3, capturedAt;

    if (mode === 'last') {
      lat3 = d?.lastLocationRounded?.lat3;
      lng3 = d?.lastLocationRounded?.lng3;
      capturedAt = d?.lastLocation?.capturedAt || d?.lastLocationRounded?.capturedAt;
    } else {
      const slot = (d.timeSlots && d.timeSlots[mode]) || null;
      lat3 = slot?.centerRounded?.lat3;
      lng3 = slot?.centerRounded?.lng3;
      capturedAt = slot?.capturedAt;
    }

    if (typeof lat3 === 'number' && typeof lng3 === 'number') {
      // Si hay recencia, filtramos; si no, lo dejamos pasar
      if (capturedAt) {
        const t = new Date(capturedAt).getTime();
        if (!isFinite(t) || t < cutoff) return;
      }
      out.push({
        id: doc.id,
        name: d?.nombre || '(sin nombre)',
        lat: lat3,
        lng: lng3,
        capturedAt: capturedAt || null
      });
    }
  });

  return out;
}

// ---------------------------
// Google Maps helpers
// ---------------------------
function initMapIfNeeded() {
  if (map) return;
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: -34.6037, lng: -58.3816 }, // CABA por defecto
    zoom: 11,
    mapTypeControl: true,
    streetViewControl: false
  });
}

function clearLayers() {
  if (heatmap) {
    heatmap.setMap(null);
    heatmap = null;
  }
  markers.forEach(m => m.setMap(null));
  markers = [];
}

function addMarkers(points) {
  clearLayers();
  const bounds = new google.maps.LatLngBounds();

  points.forEach(p => {
    const pos = { lat: p.lat, lng: p.lng };
    const m = new google.maps.Marker({ position: pos, map });
    const info = new google.maps.InfoWindow({
      content: `
        <div style="font-size:13px;line-height:1.4;">
          <div><strong>${p.name}</strong></div>
          <div>ID: ${p.id}</div>
          <div>Lat/Lng(≈110m): ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}</div>
          ${p.capturedAt ? `<div>Actualizado: ${new Date(p.capturedAt).toLocaleString()}</div>` : ''}
          <div style="margin-top:6px;">
            <a target="_blank" href="https://maps.google.com/?q=${p.lat},${p.lng}">Abrir en Google Maps</a>
          </div>
        </div>`
    });
    m.addListener('click', () => info.open({ anchor: m, map }));
    markers.push(m);
    bounds.extend(pos);
  });

  if (!bounds.isEmpty()) map.fitBounds(bounds);
}

function addHeatmap(points) {
  clearLayers();
  const heatData = points.map(p => new google.maps.LatLng(p.lat, p.lng));
  heatmap = new google.maps.visualization.HeatmapLayer({
    data: heatData,
    dissipating: true, // típico para zoom dinámico
    radius: 24        // podés ajustar
  });
  heatmap.setMap(map);

  // Fit bounds para ver todo
  const bounds = new google.maps.LatLngBounds();
  heatData.forEach(ll => bounds.extend(ll));
  if (!bounds.isEmpty()) map.fitBounds(bounds);
}

// ---------------------------
// UI wiring
// ---------------------------
async function reload() {
  initMapIfNeeded();
  const mode = document.getElementById('mode').value;
  const layer = document.getElementById('layer').value;
  const days = parseInt(document.getElementById('days').value, 10);

  const pts = await fetchClientPoints(mode, days);
  if (!pts.length) {
    clearLayers();
    return;
  }
  if (layer === 'markers') addMarkers(pts);
  else addHeatmap(pts);
}

function fitToContent() {
  if (!map) return;
  const bounds = new google.maps.LatLngBounds();
  if (heatmap) {
    heatmap.getData().forEach(ll => bounds.extend(ll));
  } else {
    markers.forEach(m => bounds.extend(m.getPosition()));
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds);
}

// ---------------------------
// Bootstrap
// ---------------------------
window.addEventListener('DOMContentLoaded', async () => {
  setupFirebaseAdmin();
  initMapIfNeeded();

  document.getElementById('reload').addEventListener('click', reload);
  document.getElementById('fit').addEventListener('click', fitToContent);
  document.getElementById('mode').addEventListener('change', reload);
  document.getElementById('layer').addEventListener('change', reload);
  document.getElementById('days').addEventListener('change', reload);

  await reload();
});
