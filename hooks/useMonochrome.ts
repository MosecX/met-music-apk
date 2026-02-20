import { useState } from 'react';
import MonochromeAPI from '../services/MonochromeAPI';

export const useMonochrome = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTracks = async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      return await MonochromeAPI.searchTracks(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      return await MonochromeAPI.getRecommendations(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get recommendations');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getPlayableUrl = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      return await MonochromeAPI.getPlayableUrl(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get stream');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    searchTracks,
    getRecommendations,
    getPlayableUrl,
  };
};