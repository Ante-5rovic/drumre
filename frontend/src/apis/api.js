import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

export const fetchUser = () => api.get('/current_user');
export const getLocations = () => api.get('/locations');
export const addCountry = (countryName) => api.post('/add-country', { countryName });
export const logout = () => api.get('/logout');

export const deleteLocation = (id) => api.delete(`/locations/${id}`);

export default api;