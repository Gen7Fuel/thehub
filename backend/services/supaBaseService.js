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

export const getLiveTankVolumes = async () => {
  const { data, error } = await supabase.rpc('get_live_tank_volumes');

  if (error) {
    console.error('Database Error:', error.message);
    throw new Error(`Could not fetch inventory: ${error.message}`);
  }

  return data.map(item => ({
    Station_SK: item.station_sk_out,
    Tank_No: item.tank_id_out, // Now returning specific tank ID
    Volume: item.volume_out,
    ReadingTime: item.reading_time_out,
    ReadingDate: item.date_sk_out
  }));
};

/**
 * Fetches the specific opening/closing volume for a tank on a specific date.
 */
export const getTankReadingsForDate = async (station_sk, tank_id, dateStr) => {
  // 1. Get Opening (Latest before 05:00:00)
  // Note: For 2026-03-23, we fallback to the first record available if 5am is missing
  let openingQuery = supabase
    .from('current_fuel_inventory')
    .select('volume, reading_time')
    .eq('station_sk', station_sk)
    .eq('tank_id', tank_id.toString())
    .eq('date_sk', dateStr);

  if (dateStr === '2026-03-23') {
    openingQuery = openingQuery.order('reading_time', { ascending: true }).limit(1);
  } else {
    openingQuery = openingQuery.lt('reading_time', '05:00:00').order('reading_time', { ascending: false }).limit(1);
  }

  const { data: openData } = await openingQuery;

  // 2. Get Closing (Latest before midnight)
  const { data: closeData } = await supabase
    .from('current_fuel_inventory')
    .select('volume')
    .eq('station_sk', station_sk)
    .eq('tank_id', tank_id.toString())
    .eq('date_sk', dateStr)
    .lt('reading_time', '23:59:59')
    .order('reading_time', { ascending: false })
    .limit(1);

  return {
    openingVolume: openData?.[0]?.volume || 0,
    openingTime: openData?.[0]?.reading_time || "05:00:00",
    closingVolume: closeData?.[0]?.volume || 0
  };
};

/**
 * Fetches fuel sales from Supabase and processes them (Mid-grade split & Mapping)
 * @param {string} csoCode - The station's CSO code
 * @param {string} dateStr - YYYY-MM-DD formatted date
 * @returns {Promise<Array>} Cleaned salesData array for Mongoose
 */
// export const getProcessedFuelSales = async (csoCode, dateStr) => {
//   // 1. Call the RPC with the wildcard for the LIKE operator
//   const { data: rawData, error } = await supabase.rpc('get_fuel_sales_by_station_and_date', {
//     target_cso_code: `${csoCode}%`,
//     target_date: dateStr
//   });

//   if (error) throw new Error(`Supabase RPC Error: ${error.message}`);

//   // 2. Initialize processing object
//   let processed = {
//     'Regular': 0,
//     'Premium': 0,
//     'Diesel': 0,
//     'Dyed Diesel': 0
//   };

//   let midVolume = 0;

//   // 3. Map raw codes to Model names and capture MID volume
//   if (rawData) {
//     rawData.forEach(item => {
//       const vol = Number(item.total_volume) || 0;
//       switch (item.raw_grade) {
//         case 'REG': processed['Regular'] += vol; break;
//         case 'PNL': processed['Premium'] += vol; break;
//         case 'DSL': processed['Diesel'] += vol; break;
//         case 'DYED': processed['Dyed Diesel'] += vol; break;
//         case 'MID': midVolume = vol; break;
//       }
//     });
//   }

//   // 4. Apply the 50/50 Mid-grade split logic
//   if (midVolume > 0) {
//     processed['Regular'] += (midVolume / 2);
//     processed['Premium'] += (midVolume / 2);
//   }

//   // 5. Convert to Mongoose schema format (only return grades with volume > 0)
//   return Object.entries(processed)
//     .filter(([_, vol]) => vol > 0)
//     .map(([grade, volume]) => ({ 
//       grade, 
//       volume: parseFloat(volume.toFixed(2)) 
//     }));
// };
export const getProcessedFuelSales = async (csoCode, dateStr) => {
  const { data: rawData, error } = await supabase.rpc('get_fuel_sales_by_station_and_date', {
    target_cso_code: `${csoCode}%`,
    target_date: dateStr
  });

  if (error) throw new Error(`Supabase RPC Error: ${error.message}`);

  let processed = { 'Regular': 0, 'Premium': 0, 'Diesel': 0, 'Dyed Diesel': 0 };
  let midVolume = 0;
  let latestTs = null;

  if (rawData && rawData.length > 0) {
    rawData.forEach(item => {
      const vol = Number(item.total_volume) || 0;
      // Track the latest transaction across all fuel grades
      if (item.last_transaction && (!latestTs || new Date(item.last_transaction) > new Date(latestTs))) {
        latestTs = item.last_transaction;
      }

      switch (item.raw_grade) {
        case 'REG': processed['Regular'] += vol; break;
        case 'PNL': processed['Premium'] += vol; break;
        case 'DSL': processed['Diesel'] += vol; break;
        case 'DYED': processed['Dyed Diesel'] += vol; break;
        case 'MID': midVolume = vol; break;
      }
    });
  }

  if (midVolume > 0) {
    processed['Regular'] += (midVolume / 2);
    processed['Premium'] += (midVolume / 2);
  }

  const salesData = Object.entries(processed)
    .filter(([_, vol]) => vol > 0)
    .map(([grade, volume]) => ({ grade, volume: parseFloat(volume.toFixed(2)) }));

  return { salesData, lastTransaction: latestTs };
};