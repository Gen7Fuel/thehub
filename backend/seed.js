const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Product = require("./models/Product");
const Location = require("./models/Location");
const FleetCustomer = require("./models/FleetCustomer");
const connectDB = require("./config/db");

dotenv.config();

const locations = [
  { type: "store", stationName: "Rankin", legalName: "Freddies", INDNumber: "560", kardpollCode: "RANKINGEN7", csoCode: "30900", timezone: "America/Toronto", email: "rankin@gen7fuel.com" },
  { type: "store", stationName: "Couchiching", legalName: "Ft Frances", INDNumber: "731", kardpollCode: "COUCHICING", csoCode: "61327", timezone: "America/Chicago", email: "office.fortfrances@gen7fuel.com" },
  { type: "store", stationName: "Jocko Point", legalName: "Nipissing", INDNumber: "519", kardpollCode: "JOCKOPOINT", csoCode: "30901", timezone: "America/Toronto", email: "office.jockopoint@gen7fuel.com" },
  { type: "store", stationName: "Sarnia", legalName: "Smokeys", INDNumber: "461", kardpollCode: "GEN7SARNIA", csoCode: "30904", timezone: "America/Toronto", email: "smokeysoffice@gen7fuel.com" },
  { type: "store", stationName: "Silver Grizzly", legalName: "Penticton", INDNumber: "744/757", kardpollCode: "PENTICTON", csoCode: "62182", timezone: "America/Vancouver", email: "office.silvergrizzly@gen7fuel.com" },
  { type: "store", stationName: "Walpole", legalName: "Bkejwanong", INDNumber: "454", kardpollCode: "GEN7WALPOLE", csoCode: "30903", timezone: "America/Toronto", email: "office.walpole@gen7fuel.com" },
  { type: "store", stationName: "Oliver", legalName: "Oliver", INDNumber: "808", kardpollCode: "GEN7OLIVER", csoCode: "68906", timezone: "America/Vancouver", email: "office.oliver@gen7fuel.com" },
  { type: "store", stationName: "Osoyoos", legalName: "Osoyoos", INDNumber: "809", kardpollCode: "GEN7OSOYOOS", csoCode: "68908", timezone: "America/Vancouver", email: "office.osoyoos@gen7fuel.com" },
];

const products = [
  { code: "REG", description: "Regular", kardpollCode: "REGULAR" },
  { code: "MID", description: "Mid-grade", kardpollCode: "MidGas" },
  { code: "PRE", description: "Premium", kardpollCode: "PREMIUM" },
  { code: "DSL", description: "Diesel", kardpollCode: "CLEAR DSL"},
  { code: "DDS", description: "Dyed Diesel", kardpollCode: "DYED DSL" },
];

const fleetCustomers = [
  { name: "AW Locksmith", email: "info@awlocksmith.com" },
  { name: "R + L Preseault Trucking", email: "prezo.goul5@sympatico.ca" },
  { name: "TCM Produce", email: "tcmchantalrose@gmail.com" },
  { name: "Clare Piper Enterprises", email: "clarepiperenterprises@bellnet.ca" },
  { name: "Surview Windows & Doors Inc", email: "martina@surview.net" },
  { name: "First North Enterprise", email: "jane@firstnorthenterprise.com" },
  { name: "Algoma Waterproofing", email: "algomawaterproofing@live.com" },
  { name: "Lambton Alloys Ltd", email: "tmils@lambtonalloys.com" },
  { name: "R.N.R Mechanical Contractors Inc.", email: "insultekrnradmin@xplornet.com" },
  { name: "Insultek Inc.", email: "insultekrnradmin@xplornet.com" },
  { name: "Fowler Construction Company Ltd.", email: "accountspayable@fowler.ca" },
  { name: "RPTL Truck Lines", email: "reg.rptl@outlook.com" },
  { name: "Gilles Gagon Trucking", email: "hurtubiseroberta@gmail.com" },
  { name: "Sherdan Sales", email: "sherdan@rogers.com" },
  { name: "Alpine (North) Construction Inc.", email: "centsaultinvestments@shaw.ca" },
  { name: "Battery Battery Inc.", email: "shawn@batterybattery.ca" },
  { name: "Seamless Eavestrough", email: "info@seamlesseavestrough.ca" },
  { name: "Staite Builders Inc..", email: "evan.staite@gmail.com" },
  { name: "Canadian Structural & Mechanical", email: "admin@cansam.com" },
  { name: "Nsido Taxi", email: "nsidotaxi@gmail.com" },
  { name: "Official Parcel Service", email: "accounting@officialparcelservice.com" },
  { name: "Tom Veert Contracting", email: "corinneyork@tomveert.com" },
  { name: "Savage Equipment Leasing & Sales", email: "carole@savegeequip.ca" },
  { name: "Don Ryan & Company Inc.", email: "keldondankels@hotmail.com" },
  { name: "Car-Dale Transportation", email: "cardale@bellnet.ca" },
  { name: "Lake of the Woods Electric (Kenora) Ltd.", email: "mail@lakeofthewoodelectric.com" },
  { name: "Tyson McLean Contracting", email: "mcleantyson@hotmail.com" },
  { name: "Fusion Welding", email: "fusionweldingAA@gmail.com" },
  { name: "Tony Hamm Trucking", email: "tghamm@hotmail.com" },
  { name: "Our Glass & Aluminium Ltd.", email: "our_glass@telus.net" },
  { name: "Ge-Da-Gi-Binez Youth Center", email: "admin@spottedeagle.ca" },
  { name: "D Bombay Transport", email: "darrelbombay@gmail.com" },
  { name: "Kent's Towing & Recovery Inc.", email: "kentstowingandrecovery@gmail.com" },
  { name: "Coyote Cruises Ltd.", email: "diana@locolanding.com" },
  { name: "Skip The Cab Personal Driver & Delivery", email: "littleroseslawncare@gmail.com" },
  { name: "Devlin Automotive & Truck Ltd.", email: "devlinautoandtruck@gmail.com" },
  { name: "Leon Degagne Ltd.", email: "info@leondegagne.com" },
  { name: "AJ Positano Paving", email: "katie@positanopaving.com" },
  { name: "Mobile Glass Inc", email: "beth@mobileglassinc.ca" },
  { name: "Treaty Three Police", email: "payable@t3ps.ca" },
  { name: "McLeod Barging & Construction", email: "mcleodbarging@gmail.com" },
  { name: "Warren's Custom DZL Inc", email: "ronda@warrenscustomdzl.com" },
  { name: "Pro Tow", email: "protow300@gmail.com" },
  { name: "McLean Construction", email: "accounting@mcleanconstruction.ca" },
  { name: "Henry's Trucking", email: "nanako@bell.net" },
  { name: "Premier Fencing", email: "premierfencing@outlook.com" },
  { name: "Gizhewaadiziwin Health Access Centre", email: "ddegagne@gizhac.com" },
  { name: "Spirit Ridge Owner Association", email: "martin.drainville@hyatt.com" },
];

const seedDB = async () => {
  await connectDB();

  await Product.deleteMany({});
  await Product.insertMany(products);

  await Location.deleteMany({});
  await Location.insertMany(locations);

  await FleetCustomer.deleteMany({});
  await FleetCustomer.insertMany(fleetCustomers);

  console.log("Database seeded!");
  console.log(`Seeded ${products.length} products`);
  console.log(`Seeded ${locations.length} locations`);
  console.log(`Seeded ${fleetCustomers.length} fleet customers`);
  
  mongoose.connection.close();
};

seedDB();