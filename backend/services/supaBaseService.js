import { supabase } from '../utils/supabase/server.js';

/**
 * Fetches the ranked fuel inventory from the Supabase RPC function.
 * @returns {Promise<Array>} Cleaned inventory data
 */
export const getRankedFuelInventory = async () => {
  const { data, error } = await supabase.rpc('get_ranked_fuel_inventory');

  if (error) {
    console.error('Database Error:', error.message);
    throw new Error(`Could not fetch inventory: ${error.message}`);
  }

  // Optional: Map the database names back to your preferred JS naming convention
  return data.map(item => ({
    Station_SK: item.station_sk_out,
    Fuel_Grade: item.fuel_grade_out,
    Stick_L: item.stick_l_out
  }));
};