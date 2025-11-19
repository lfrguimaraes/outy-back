const axios = require('axios');
const mapboxToken = process.env.MAPBOX_TOKEN;

async function geocodeAddress(address) {
  if (mapboxToken) {
    const res = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`, {
      params: {
        access_token: mapboxToken,
        limit: 1
      }
    });

    if (res.data.features.length > 0) {
      const [lng, lat] = res.data.features[0].center;
      return { lat, lng };
    }
    return null;
  }

  // fallback to Nominatim if no Mapbox token
  const res = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: address,
      format: 'json',
      limit: 1,
      email: 'your@email.com'
    },
    headers: {
      'User-Agent': 'Outy App/1.0 (https://yourapp.com)'
    }
  });

  if (res.data.length > 0) {
    const { lat, lon } = res.data[0];
    return { lat: parseFloat(lat), long: parseFloat(lon) };
  }

  return null;
}

module.exports = { geocodeAddress };