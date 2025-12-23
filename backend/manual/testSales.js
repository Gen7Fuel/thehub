import {getWeeklyBistroSales} from '../services/sqlService.js';

export async function testWeeklyBistroSales() {
  try {
    const data = await getWeeklyBistroSales('30900');
    console.log('Weekly Bistro Sales Data:', data);
  } catch (error) {
    console.error('Error fetching Weekly Bistro Sales Data:', error);
  } 
}

testWeeklyBistroSales();