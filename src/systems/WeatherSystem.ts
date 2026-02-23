// Weather transitions are handled in the reducer's processDayTick().
// This file provides display helpers.

import { WeatherType } from '../state/types';

export function getWeatherEmoji(weather: WeatherType): string {
  switch (weather) {
    case 'sunny':  return '☀️';
    case 'cloudy': return '⛅';
    case 'rain':   return '🌧️';
    case 'storm':  return '⛈️';
  }
}

export function getWeatherLabel(weather: WeatherType): string {
  switch (weather) {
    case 'sunny':  return 'Sunny';
    case 'cloudy': return 'Cloudy';
    case 'rain':   return 'Rain';
    case 'storm':  return 'Storm';
  }
}
